import lnService, {
  AuthenticatedLnd,
  CreateInvoiceResult,
  GetInvoiceResult,
  GetWalletInfoResult,
} from "lightning";

/**
 * Lightning service
 */
export default class Lightning {
  public host: string;
  public port: string;
  public lnd: AuthenticatedLnd;

  /**
   * Create a new Lightning service
   * @param macaroon the invoice macaroon
   * @param host the host of the lnd node
   * @param port the port of the lnd node
   */
  constructor(macaroon: string, host: string, port: number | string) {
    this.host = host;
    this.port = port.toString();
    const socket = `${this.host}:${this.port}`;
    const { lnd } = lnService.authenticatedLndGrpc({
      macaroon,
      socket,
    });
    this.lnd = lnd;
  }

  /**
   * Create a lightning invoice
   * @param description The description of the invoice
   * @param amount The amount of the invoice
   * @returns The invoice
   */
  public async createInvoice(
    description: string,
    amount: number
  ): Promise<CreateInvoiceResult> {
    const invoice = await lnService.createInvoice({
      lnd: this.lnd,
      description,
      tokens: amount,
    });
    return invoice;
  }

  /**
   * Get a lightning invoice
   * @param id The id of the invoice
   * @returns The invoice
   */
  public async getInvoice(id: string): Promise<GetInvoiceResult> {
    const invoice = await lnService.getInvoice({
      lnd: this.lnd,
      id,
    });
    return invoice;
  }

  /**
   * Get the wallet info
   * @returns The wallet info
   */
  public async getWalletInfo(): Promise<GetWalletInfoResult> {
    const walletInfo = await lnService.getWalletInfo({
      lnd: this.lnd,
    });
    return walletInfo;
  }
}
