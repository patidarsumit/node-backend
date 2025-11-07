class ApiResponse {
  constructor(statusCode, data, message = "Request successful") {
    this.statusCode = statusCode < 400;
    this.data = data;
    this.message = message;
    this.success = true;
  }
}

export default ApiResponse;
