class ApiResponse {
  /**
   * Standard success envelope for all API responses.
   */
  static success(res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) {
    const payload = {
      success: true,
      message,
      data,
    };

    if (meta) {
      payload.meta = meta;
    }

    return res.status(statusCode).json(payload);
  }

  static created(res, { message = 'Created', data = null } = {}) {
    return ApiResponse.success(res, { statusCode: 201, message, data });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

export default ApiResponse;
