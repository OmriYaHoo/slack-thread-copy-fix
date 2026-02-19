// Slack Thread Copy Fix v2
// Adds a "Copy text" button to message action toolbars

(function () {
  "use strict";

  function copyRichText(html, plainText) {
    const blob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([plainText], { type: "text/plain" });
    navigator.clipboard
      .write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": textBlob,
        }),
      ])
      .then(() => showToast("Copied!"))
      .catch(() => {
        navigator.clipboard.writeText(plainText);
        showToast("Copied (plain text)");
      });
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "stcf-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  function getMessageContent(messageEl) {
    const bodyEl = messageEl.querySelector(".p-rich_text_block");
    if (!bodyEl) return null;
    return {
      html: bodyEl.innerHTML,
      text: bodyEl.innerText,
    };
  }

  // Walk up from the toolbar to find the message container
  function findMessageFromToolbar(toolbar) {
    // The toolbar is a sibling/child within the same message wrapper
    // Walk up until we find something with .p-rich_text_block inside
    let el = toolbar.parentElement;
    while (el && el !== document.body) {
      if (el.querySelector(".p-rich_text_block")) return el;
      el = el.parentElement;
    }
    return null;
  }

  // The copy button SVG (clipboard icon)
  const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true" style="width:16px;height:16px"><path fill="currentColor" fill-rule="evenodd" d="M7.5 2.5A1.5 1.5 0 0 1 9 1h5a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 14 13H9a1.5 1.5 0 0 1-1.5-1.5v-9zM9 2.5h5v9H9v-9zM4.5 5A1.5 1.5 0 0 0 3 6.5v9A1.5 1.5 0 0 0 4.5 17h5a1.5 1.5 0 0 0 1.5-1.5V15h-1v.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5H5V5h-.5z" clip-rule="evenodd"/></svg>`;

  function injectCopyButton(actionsGroup) {
    if (actionsGroup.querySelector(".stcf-copy-btn")) return;

    // Find the "More actions" button to insert before it
    const moreBtn = actionsGroup.querySelector('[data-qa="more_message_actions"]');

    const btn = document.createElement("button");
    btn.className =
      "stcf-copy-btn c-button-unstyled c-icon_button c-icon_button--size_small c-message_actions__button c-icon_button--default";
    btn.setAttribute("aria-label", "Copy text");
    btn.setAttribute("data-sk", "tooltip_parent");
    btn.setAttribute("type", "button");
    btn.innerHTML = COPY_SVG;

    // Add tooltip span like other buttons
    const tooltip = document.createElement("span");
    tooltip.hidden = true;
    tooltip.setAttribute("data-sk", "tooltip");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const messageEl = findMessageFromToolbar(actionsGroup);
      if (!messageEl) return;
      const content = getMessageContent(messageEl);
      if (content) {
        copyRichText(content.html, content.text);
      }
    });

    if (moreBtn) {
      // Insert before "More actions" and its preceding tooltip
      actionsGroup.insertBefore(tooltip, moreBtn);
      actionsGroup.insertBefore(btn, tooltip);
    } else {
      actionsGroup.appendChild(btn);
      actionsGroup.appendChild(tooltip);
    }
  }

  // Watch for action toolbars appearing (they're dynamically added on hover)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        // Check if the added node IS a toolbar or CONTAINS one
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

  // Also catch any already-visible toolbars
  document.querySelectorAll('[data-qa="message-actions"]').forEach(injectCopyButton);
})();
