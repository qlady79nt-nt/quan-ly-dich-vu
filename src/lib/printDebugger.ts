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

export const exportPrintDebug = () => {
  const json = JSON.stringify(PrintDebugState, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `print_debug_${new Date().getTime()}.json`;
  a.click();
  console.log("EXPORTED PRINT DEBUG JSON");
};
