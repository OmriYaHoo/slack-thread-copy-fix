// Slack Thread Copy Fix v3
// Adds a "Copy text" button to message action toolbars
// Converts Slack's custom DOM to clean HTML for proper rich-text copy

(function () {
  "use strict";

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "stcf-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  // Convert Slack's DOM into clean HTML that pastes well
  function convertToCleanHtml(slackEl) {
    const clone = slackEl.cloneNode(true);

    // Remove paragraph-break spacer spans (replace with actual line breaks)
    clone.querySelectorAll(".c-mrkdwn__br").forEach((el) => {
      el.replaceWith(document.createElement("br"));
    });

    // Convert Slack code blocks: pre.p-rich_text_preformatted → <pre><code>
    clone.querySelectorAll('[class*="rich_text_preformatted"]').forEach((el) => {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = el.textContent;
      pre.appendChild(code);
      el.replaceWith(pre);
    });

    // Convert inline code: span/code with Slack classes
    clone.querySelectorAll('[class*="c-mrkdwn__code"], [data-stringify-type="code"]').forEach((el) => {
      const code = document.createElement("code");
      code.textContent = el.textContent;
      el.replaceWith(code);
    });

    // Convert Slack quote blocks
    clone.querySelectorAll('[class*="rich_text_quote"]').forEach((el) => {
      const bq = document.createElement("blockquote");
      bq.innerHTML = el.innerHTML;
      el.replaceWith(bq);
    });

    // Convert rich_text_section divs to paragraphs for better paste behavior
    clone.querySelectorAll(".p-rich_text_section").forEach((el) => {
      const p = document.createElement("p");
      p.innerHTML = el.innerHTML;
      el.replaceWith(p);
    });

    // Lists should already be <ol>/<ul>/<li> — keep them
    // Bold <b>, italic <i>, strikethrough <s> — all standard, keep them

    return clone.innerHTML;
  }

  // Build a clean plain-text version that preserves structure
  function convertToPlainText(slackEl) {
    const clone = slackEl.cloneNode(true);

    // Add newlines for paragraph breaks
    clone.querySelectorAll(".c-mrkdwn__br").forEach((el) => {
      el.replaceWith("\n");
    });

    // Add backticks around inline code
    clone.querySelectorAll('[class*="c-mrkdwn__code"], [data-stringify-type="code"]').forEach((el) => {
      el.textContent = "`" + el.textContent + "`";
    });

    // Add triple backticks around code blocks
    clone.querySelectorAll('[class*="rich_text_preformatted"]').forEach((el) => {
      el.textContent = "```\n" + el.textContent + "\n```";
    });

    // Number ordered list items
    clone.querySelectorAll("ol").forEach((ol) => {
      ol.querySelectorAll(":scope > li").forEach((li, i) => {
        li.textContent = (i + 1) + ". " + li.textContent;
      });
    });

    // Bullet unordered list items
    clone.querySelectorAll("ul").forEach((ul) => {
      ul.querySelectorAll(":scope > li").forEach((li) => {
        li.textContent = "• " + li.textContent;
      });
    });

    // Add > for quotes
    clone.querySelectorAll('[class*="rich_text_quote"]').forEach((el) => {
      el.textContent = el.textContent.split("\n").map((l) => "> " + l).join("\n");
    });

    return clone.innerText;
  }

  function copyRichText(slackEl) {
    const html = convertToCleanHtml(slackEl);
    const text = convertToPlainText(slackEl);

    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([text], { type: "text/plain" });
    navigator.clipboard
      .write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ])
      .then(() => showToast("Copied!"))
      .catch(() => {
        navigator.clipboard.writeText(text);
        showToast("Copied (plain text)");
      });
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
        copyRichText(block);
      }
    });

    if (moreBtn) {
      actionsGroup.insertBefore(tooltip, moreBtn);
      actionsGroup.insertBefore(btn, tooltip);
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
