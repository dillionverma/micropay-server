import lnService, {
  AuthenticatedLnd,
  CreateHodlInvoiceResult,
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
   * Create a HODL Invoice
   * @param id The payment hash, which is sha256(preimage)
   * @param description The description of the invoice
   * @param amount The amount of the invoice
   * @returns The invoice
   */
  public async createHodlInvoice(
    id: string,
    description: string,
    amount: number,
    expiresAt?: Date
  ): Promise<CreateHodlInvoiceResult> {
    const walletInfo = await lnService.createHodlInvoice({
      lnd: this.lnd,
      id,
      description,
      tokens: amount,
      expires_at: expiresAt?.toISOString(),
    });
    return walletInfo;
  }

  /**
   * Settle a HODL Invoice
   * @param preimage The preimage of the invoice
   * @returns
   */
  public async settleHodlInvoice(preimage: string): Promise<void> {
    await lnService.settleHodlInvoice({
      lnd: this.lnd,
      secret: preimage,
    });
  }

  /**
   * Cancel a HODL Invoice
   * @param invoiceId The invoice id
   * @returns
   */
  public async cancelHodlInvoice(invoiceId: string): Promise<void> {
    await lnService.cancelHodlInvoice({
      lnd: this.lnd,
      id: invoiceId,
    });
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
