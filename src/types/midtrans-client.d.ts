declare module 'midtrans-client' {
  export class Snap {
    constructor(options: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
    });
    createTransaction(parameter: any): Promise<any>;
    createTransactionToken(parameter: any): Promise<string>;
  }

  export class CoreApi {
    constructor(options: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
    });
    transaction: {
      notification(notificationJson: any): Promise<any>;
      status(orderId: string): Promise<any>;
      approve(orderId: string): Promise<any>;
      cancel(orderId: string): Promise<any>;
      expire(orderId: string): Promise<any>;
      refund(orderId: string, parameter?: any): Promise<any>;
    };
  }
}
