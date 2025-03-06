export type File = {
  id : string,
  filename : string,
  key : string,
  size : number,
  type : string,
  uploaded_at : Date,
  is_public : boolean,
  bucket : string,
}

export type FilewithURL = {
  id : string,
  filename : string,
  key : string,
  size : number,
  type : string,
  uploaded_at : Date,
  is_public : boolean,
  bucket : string,
  url: string
}
