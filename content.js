// Slack Thread Copy Fix v5
// Adds a "Copy text" button to message action toolbars
// Converts Slack's custom DOM to clean Markdown for clipboard

(function () {
  "use strict";

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "stcf-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  // Extract unicode emoji from Slack emoji img src URL
  // URLs look like: .../14.0/google-small/1f504@2x.png
  function emojiFromSrc(src) {
    try {
      const match = src.match(/\/([0-9a-f-]+)@2x\.png/i);
      if (match) {
        return match[1]
          .split("-")
          .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
          .join("");
      }
    } catch (e) {}
    return null;
  }

  // Convert a Slack DOM node tree into Markdown text
  function convertToMarkdown(slackEl) {
    const clone = slackEl.cloneNode(true);

    // Remove reaction containers and timestamps that aren't message content
    clone.querySelectorAll('[class*="reaction"]').forEach((el) => el.remove());

    return nodeToMarkdown(clone).trim();
  }

  function nodeToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    const classes = (typeof node.className === "string" ? node.className : "") || "";

    // Emoji images
    if (tag === "img" && node.getAttribute("data-stringify-type") === "emoji") {
      // Try to get unicode from src URL
      const emoji = emojiFromSrc(node.src);
      if (emoji) return emoji;
      // Fallback to :name: format
      const name = node.getAttribute("data-stringify-emoji") || node.alt || "";
      return name.startsWith(":") ? name : ":" + name + ":";
    }

    // Skip non-emoji images entirely
    if (tag === "img") {
      return "";
    }

    // Line break spacers
    if (classes.includes("c-mrkdwn__br")) {
      return "\n";
    }

    // Code blocks
    if (classes.includes("rich_text_preformatted") || classes.includes("c-mrkdwn__pre")) {
      return "```\n" + node.textContent.trimEnd() + "\n```";
    }

    // Inline code
    if (
      classes.includes("c-mrkdwn__code") ||
      node.getAttribute("data-stringify-type") === "code" ||
      (tag === "code" && !node.closest("pre"))
    ) {
      return "`" + node.textContent + "`";
    }

    // Quote blocks
    if (classes.includes("rich_text_quote")) {
      const inner = childrenToMarkdown(node);
      return inner
        .split("\n")
        .map((l) => "> " + l)
        .join("\n");
    }

    // Bold
    if (tag === "b" || tag === "strong") {
      return "**" + childrenToMarkdown(node) + "**";
    }

    // Italic
    if (tag === "i" || tag === "em") {
      return "_" + childrenToMarkdown(node) + "_";
    }

    // Strikethrough
    if (tag === "s" || tag === "strike" || tag === "del") {
      return "~~" + childrenToMarkdown(node) + "~~";
    }

    // Links
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const text = childrenToMarkdown(node);
      if (text === href || !href) return text;
      return "[" + text + "](" + href + ")";
    }

    // Ordered lists
    if (tag === "ol") {
      const items = Array.from(node.querySelectorAll(":scope > li"));
      return items.map((li, i) => (i + 1) + ". " + childrenToMarkdown(li)).join("\n");
    }

    // Unordered lists
    if (tag === "ul") {
      const items = Array.from(node.querySelectorAll(":scope > li"));
      return items.map((li) => "- " + childrenToMarkdown(li)).join("\n");
    }

    // List items (when processed directly)
    if (tag === "li") {
      return childrenToMarkdown(node);
    }

    // Line breaks
    if (tag === "br") {
      return "\n";
    }

    // Paragraphs / sections — add spacing
    if (tag === "p" || classes.includes("p-rich_text_section")) {
      const inner = childrenToMarkdown(node);
      return inner + "\n";
    }

    // Default: recurse into children
    return childrenToMarkdown(node);
  }

  function childrenToMarkdown(node) {
    let result = "";
    for (const child of node.childNodes) {
      result += nodeToMarkdown(child);
    }
    return result;
  }

  function copyMarkdown(slackEl) {
    const markdown = convertToMarkdown(slackEl);
    navigator.clipboard
      .writeText(markdown)
      .then(() => showToast("Copied!"))
      .catch(() => showToast("Copy failed"));
  }

  function getMessageBlock(messageEl) {
    return messageEl.querySelector(".p-rich_text_block");
  }

  function findMessageFromToolbar(toolbar) {
    let el = toolbar.parentElement;
    while (el && el !== document.body) {
      if (el.querySelector(".p-rich_text_block")) return el;
      el = el.parentElement;
    }
    return null;
  }

  const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true" style="width:16px;height:16px"><path fill="currentColor" fill-rule="evenodd" d="M7.5 2.5A1.5 1.5 0 0 1 9 1h5a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 14 13H9a1.5 1.5 0 0 1-1.5-1.5v-9zM9 2.5h5v9H9v-9zM4.5 5A1.5 1.5 0 0 0 3 6.5v9A1.5 1.5 0 0 0 4.5 17h5a1.5 1.5 0 0 0 1.5-1.5V15h-1v.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5H5V5h-.5z" clip-rule="evenodd"/></svg>`;

  function injectCopyButton(actionsGroup) {
    if (actionsGroup.querySelector(".stcf-copy-btn")) return;

    const moreBtn = actionsGroup.querySelector('[data-qa="more_message_actions"]');

    const btn = document.createElement("button");
    btn.className =
      "stcf-copy-btn c-button-unstyled c-icon_button c-icon_button--size_small c-message_actions__button c-icon_button--default";
    btn.setAttribute("aria-label", "Copy text");
    btn.setAttribute("data-sk", "tooltip_parent");
    btn.setAttribute("type", "button");
    btn.innerHTML = COPY_SVG;

    // Use Slack's native tooltip system
    const tooltip = document.createElement("span");
    tooltip.hidden = true;
    tooltip.setAttribute("data-sk", "tooltip");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const messageEl = findMessageFromToolbar(actionsGroup);
      if (!messageEl) return;
      const block = getMessageBlock(messageEl);
      if (block) {
        copyMarkdown(block);
      }
    });

    if (moreBtn) {
      actionsGroup.insertBefore(btn, moreBtn);
      actionsGroup.insertBefore(tooltip, moreBtn);
    } else {
      actionsGroup.appendChild(btn);
      actionsGroup.appendChild(tooltip);
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const toolbars = [];
        if (node.matches && node.matches('[data-qa="message-actions"]')) {
          toolbars.push(node);
        }
        if (node.querySelectorAll) {
          toolbars.push(...node.querySelectorAll('[data-qa="message-actions"]'));
        }
        toolbars.forEach(injectCopyButton);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('[data-qa="message-actions"]').forEach(injectCopyButton);
})();
