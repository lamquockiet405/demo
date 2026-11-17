import { PaymentsController } from '../../../src/modules/payments/controllers/payments.controller';
import { VnpayService } from '../../../src/modules/payments/services/vnpay.service';
import { createHmac } from 'crypto';

describe('Parent breakfast checkout', () => {
  const parent = { sub: 13, id: '13', roles: ['PARENT'] };

  it('derives the payer from the session when the browser omits parentId', async () => {
    const api = { createInvoice: jest.fn().mockResolvedValue({ registrationId: '44' }) };
    const controller = new PaymentsController(api as any);
    await controller.createInvoice({ studentId: 3, periodId: 9 }, parent);
    expect(api.createInvoice).toHaveBeenCalledWith({ studentId: 3, periodId: 9, parentId: 13 });
  });

  it('ignores a different payer supplied by a parent browser', async () => {
    const api = { createInvoice: jest.fn() };
    await new PaymentsController(api as any).createInvoice({ studentId: 3, periodId: 9, parentId: 99 }, parent);
    expect(api.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ parentId: 13 }));
  });

  it('keeps the selected parent when staff creates an invoice', async () => {
    const api = { createInvoice: jest.fn() };
    await new PaymentsController(api as any).createInvoice({ parentId: 99 }, { sub: 1, roles: ['PRINCIPAL'] });
    expect(api.createInvoice).toHaveBeenCalledWith({ parentId: 99 });
  });

  function setup(feeAmount: number | null = 25000) {
    const reg = { id: 44, parentId: 13, status: 'PENDING', period: { status: 'OPEN', feeAmount }, student: { fullName: 'Child' } };
    const repo = { findOne: jest.fn().mockResolvedValue(reg), save: jest.fn(), create: jest.fn() };
    const settings: Record<string, string> = {
      'vnpay.tmnCode': 'TEST', 'vnpay.hashSecret': 'test-only-secret',
      'vnpay.url': 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      'vnpay.returnUrl': 'http://localhost:5174/payments/vnpay-return',
    };
    const payments = { create: jest.fn(value => value), save: jest.fn().mockResolvedValue({}), findOne: jest.fn().mockResolvedValue(null) };
    const service = new VnpayService({ get: (key: string) => settings[key] } as any, payments as any, repo as any, {} as any, {} as any);
    return { service, reg, payments };
  }

  it('uses the exact package total even below 50,000 VND', async () => {
    const { service } = setup();
    const result = await service.createPaymentUrl({ registrationId: 44, parentId: 13 });
    const url = new URL(result.paymentUrl);
    expect(result.amount).toBe(25000);
    expect(url.searchParams.get('vnp_Amount')).toBe('2500000');
    expect(url.searchParams.get('vnp_ReturnUrl')).toBe('http://localhost:5174/payments/vnpay-return');
  });

  it('rejects checkout for another parent invoice', async () => {
    await expect(setup().service.createPaymentUrl({ registrationId: 44, parentId: 99 })).rejects.toThrow('Bạn không có quyền');
  });

  it('records the same package total after a signed successful callback', async () => {
    const { service, payments } = setup();
    const query: Record<string, string> = { vnp_Amount: '2500000', vnp_ResponseCode: '00', vnp_TransactionNo: 'QA', vnp_TxnRef: '44_123' };
    const encoded = new URLSearchParams(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))).toString();
    query.vnp_SecureHash = createHmac('sha512', 'test-only-secret').update(encoded).digest('hex');
    expect(await service.handleIpn(query)).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(payments.save).toHaveBeenCalledWith(expect.objectContaining({ amount: 25000, status: 'SUCCESS' }));
  });

  it('shows the package total consistently on the receipt', async () => {
    const receipt = await setup().service.getElectronicReceipt(44, 13);
    expect(receipt.serviceDetails.totalAmount).toBe(25000);
  });

  it.each([null, 0, -1, NaN])('rejects an unpayable package total %s', async fee => {
    await expect(setup(fee).service.createPaymentUrl({ registrationId: 44, parentId: 13 })).rejects.toThrow('mức phí thanh toán hợp lệ');
  });
});
