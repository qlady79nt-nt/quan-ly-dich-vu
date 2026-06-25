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
  
  PrintDebugState.beforePrint = {
    role: profile?.role,
    scrollY: window.scrollY,
    scrollX: window.scrollX,
    bodyHeight: document.body.scrollHeight,
    receiptRect,
    wrapperRect
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
