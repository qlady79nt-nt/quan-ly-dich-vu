export const PrintDebugState = {
  events: [] as any[],
  tree: {} as any,
  dom: {} as any,
  counts: {} as any,
  createPortalInfo: 'ReceiptTemplate đang render bằng: PrintContainer > createPortal (vào document.body)',
  beforePrint: {} as any,
  afterPrint: {} as any,
  cssComputed: {} as any,
};

export const logPrintEvent = (name: string, extra: any = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[PRINT EVENT] ${name}`, timestamp, extra);
  PrintDebugState.events.push({ name, timestamp, ...extra });
};

export const captureComputedStyle = (selector: string) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const style = window.getComputedStyle(el);
  return {
    display: style.display,
    position: style.position,
    top: style.top,
    left: style.left,
    opacity: style.opacity,
    height: style.height,
    overflow: style.overflow,
    transform: style.transform,
    zIndex: style.zIndex,
  };
};

export const captureBeforePrint = (profile: any) => {
  const receiptRect = document.querySelector('.receipt-container')?.getBoundingClientRect();
  const wrapperRect = document.querySelector('.print-container-wrapper')?.getBoundingClientRect();
  
  // 1. DOM CHAIN TRƯỚC KHI IN
  const receipt = document.querySelector('.receipt-container');
  let node = receipt as HTMLElement | null;
  const parents = [];
  while (node) {
    const style = window.getComputedStyle(node);
    parents.push({
      tag: node.tagName,
      id: node.id,
      class: node.className,
      position: style.position,
      display: style.display,
      overflow: style.overflow,
      height: style.height,
      transform: style.transform
    });
    node = node.parentElement;
  }

  // 2. Độ dài body.innerHTML
  const bodyHtmlLength = document.body.innerHTML.length;

  // 3. Các elements fixed position
  const fixedElements = Array.from(document.querySelectorAll('*'))
    .filter(x => window.getComputedStyle(x).position === 'fixed')
    .map(x => {
      const style = window.getComputedStyle(x);
      return {
        tag: x.tagName,
        id: x.id,
        class: x.className,
        zIndex: style.zIndex,
        display: style.display,
        opacity: style.opacity,
      };
    });

  // 4. Modal / Overlay count
  const overlays = {
    modal: document.querySelectorAll('.modal').length,
    dialogRole: document.querySelectorAll('[role="dialog"]').length,
    overlay: document.querySelectorAll('.overlay').length,
    drawer: document.querySelectorAll('.drawer').length,
    sheet: document.querySelectorAll('.sheet').length,
    dialog: document.querySelectorAll('.dialog').length,
  };
  
  PrintDebugState.beforePrint = {
    role: profile?.role,
    scrollY: window.scrollY,
    scrollX: window.scrollX,
    bodyHeight: document.body.scrollHeight,
    receiptRect,
    wrapperRect,
    domChain: parents,
    bodyHtmlLength,
    fixedElements,
    overlays
  };
  
  PrintDebugState.cssComputed.before = {
    receipt: captureComputedStyle('.receipt-container'),
    wrapper: captureComputedStyle('.print-container-wrapper'),
  };
  
  console.log('--- BEFORE PRINT ---', PrintDebugState.beforePrint);
  console.log('--- CSS BEFORE PRINT ---', PrintDebugState.cssComputed.before);

  requestAnimationFrame(() => {
    const receipt = document.querySelector('.receipt-container');
    const wrapper = document.querySelector('.print-container-wrapper');
    
    // 1. Log computed styles inside requestAnimationFrame
    const rAnimLog = {
      receipt: receipt ? {
        display: window.getComputedStyle(receipt).display,
        position: window.getComputedStyle(receipt).position,
        height: window.getComputedStyle(receipt).height,
        opacity: window.getComputedStyle(receipt).opacity,
        transform: window.getComputedStyle(receipt).transform,
      } : null,
      wrapper: wrapper ? {
        display: window.getComputedStyle(wrapper).display,
        position: window.getComputedStyle(wrapper).position,
        height: window.getComputedStyle(wrapper).height,
        opacity: window.getComputedStyle(wrapper).opacity,
        transform: window.getComputedStyle(wrapper).transform,
      } : null,
      body: {
        display: window.getComputedStyle(document.body).display,
        position: window.getComputedStyle(document.body).position,
        height: window.getComputedStyle(document.body).height,
        padding: window.getComputedStyle(document.body).padding,
        margin: window.getComputedStyle(document.body).margin,
      },
      html: {
        display: window.getComputedStyle(document.documentElement).display,
        position: window.getComputedStyle(document.documentElement).position,
        height: window.getComputedStyle(document.documentElement).height,
        padding: window.getComputedStyle(document.documentElement).padding,
        margin: window.getComputedStyle(document.documentElement).margin,
      }
    };
    
    console.log("--- RAF COMPUTED STYLES ---", rAnimLog);
    PrintDebugState.cssComputed.raf = rAnimLog;

    // 2. document.styleSheets
    const styleSheetsLog = Array.from(document.styleSheets).map(sheet => {
      let ruleCount = 0;
      try {
        ruleCount = sheet.cssRules ? sheet.cssRules.length : 0;
      } catch(e) {
        ruleCount = -1; // CORS or blocked
      }
      return {
        href: sheet.href,
        title: sheet.title,
        ruleCount
      };
    });
    console.log("--- STYLESHEETS ---", styleSheetsLog);
    PrintDebugState.cssComputed.styleSheets = styleSheetsLog;

    // 3. Find last matching rules for specific selectors
    const selectorsToTrack = ['.print-only', '.receipt-container', '.print-container-wrapper', 'body', 'html'];
    const lastMatchingRules: any = {};
    
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        const rules = sheet.cssRules;
        if (!rules) return;
        Array.from(rules).forEach((rule: any) => {
          if (rule.type === CSSRule.STYLE_RULE) {
            selectorsToTrack.forEach(sel => {
              if (rule.selectorText && rule.selectorText.includes(sel)) {
                if (!lastMatchingRules[sel]) lastMatchingRules[sel] = [];
                lastMatchingRules[sel].push({
                  sheet: sheet.href || 'inline',
                  cssText: rule.cssText
                });
              }
            });
          } else if (rule.type === CSSRule.MEDIA_RULE) {
            if (rule.conditionText.includes('print')) {
              Array.from(rule.cssRules).forEach((mediaRule: any) => {
                if (mediaRule.type === CSSRule.STYLE_RULE) {
                  selectorsToTrack.forEach(sel => {
                    if (mediaRule.selectorText && mediaRule.selectorText.includes(sel)) {
                      if (!lastMatchingRules[sel + ' (@media print)']) lastMatchingRules[sel + ' (@media print)'] = [];
                      lastMatchingRules[sel + ' (@media print)'].push({
                        sheet: sheet.href || 'inline',
                        cssText: mediaRule.cssText
                      });
                    }
                  });
                }
              });
            }
          }
        });
      } catch (e) {
        // Ignore CORS errors
      }
    });

    console.log("--- LAST MATCHING RULES ---", lastMatchingRules);
    PrintDebugState.cssComputed.lastMatchingRules = lastMatchingRules;

    // 4. classNames
    const classNamesLog = {
      body: document.body.className,
      html: document.documentElement.className
    };
    console.log("--- CLASSNAMES ---", classNamesLog);
    PrintDebugState.cssComputed.classNames = classNamesLog;

    // 5. matchMedia('print')
    const isPrintMediaActive = window.matchMedia('print').matches;
    console.log("--- MATCHMEDIA PRINT ---", isPrintMediaActive);
    PrintDebugState.cssComputed.isPrintMediaActive = isPrintMediaActive;
  });
};

export const captureAfterPrint = (completedInvoice: any, isPrinting: boolean) => {
  PrintDebugState.afterPrint = {
    completedInvoice: !!completedInvoice,
    isPrinting,
    receiptCount: document.querySelectorAll('.receipt-container').length
  };
  
  PrintDebugState.cssComputed.after = {
    receipt: captureComputedStyle('.receipt-container'),
    wrapper: captureComputedStyle('.print-container-wrapper'),
  };
  
  console.log('--- AFTER PRINT ---', PrintDebugState.afterPrint);
  console.log('--- CSS AFTER PRINT ---', PrintDebugState.cssComputed.after);
};

export const captureComponentTree = (profile: any, completedInvoice: any, isPrinting: boolean, renderInline: boolean, debugMode: boolean) => {
  PrintDebugState.tree = {
    role: profile?.role,
    completedInvoice: !!completedInvoice,
    isPrinting,
    renderInline,
    debugMode,
    receiptExists: !!document.querySelector('.receipt-container'),
    printWrapperExists: !!document.querySelector('.print-container-wrapper')
  };
  console.log('--- COMPONENT TREE ---', PrintDebugState.tree);
};

export const captureDOM = () => {
  PrintDebugState.dom = {
    receipt: document.querySelector('.receipt-container')?.outerHTML,
    wrapper: document.querySelector('.print-container-wrapper')?.outerHTML
  };
  PrintDebugState.counts = {
    receiptCount: document.querySelectorAll('.receipt-container').length,
    printOnlyCount: document.querySelectorAll('.print-only').length,
    wrapperCount: document.querySelectorAll('.print-container-wrapper').length
  };
  console.log('--- DOM ---', PrintDebugState.dom);
  console.log('--- COUNTS ---', PrintDebugState.counts);
};

