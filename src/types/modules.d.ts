declare module "unzipper" {
  import { Readable } from "stream";
  export function Extract(opts: { path: string }): NodeJS.WritableStream;
  export function Parse(): NodeJS.ReadWriteStream;
}

declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    info: any;
  }
  function pdfParse(buffer: Buffer): Promise<PDFData>;
  export default pdfParse;
}
