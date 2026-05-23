import { NextResponse } from "next/server";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  meta?: any;
}

export const successResponse = <T>(
  data: T,
  message: string = "Success",
  statusCode: number = 200,
  meta?: any
) => {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      ...(meta && { meta }),
    } as ApiResponse<T>,
    { status: statusCode }
  );
};

export const errorResponse = (
  message: string = "Internal Server Error",
  statusCode: number = 500,
  error?: any
) => {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(error && { error }),
    } as ApiResponse<null>,
    { status: statusCode }
  );
};
