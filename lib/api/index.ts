/**
 * API 模块统一导出
 */

export type {
  ApiResponse,
  ErrorInterceptor,
  HttpMethod,
  RequestInterceptor,
  RequestOptions,
  ResponseInterceptor,
} from "@/lib/request";
export {
  addErrorInterceptor,
  addRequestInterceptor,
  addResponseInterceptor,
  del,
  get,
  patch,
  post,
  put,
  RequestError,
  request,
  upload,
} from "@/lib/request";
