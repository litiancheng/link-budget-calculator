declare module 'tabulator-tables' {
  // The prototype only needs the runtime constructor; Tabulator 6.5 does not
  // expose a declaration file through the package entry used by Vite.
  export const TabulatorFull: any
}
