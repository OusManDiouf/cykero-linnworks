import { OrderDto } from '../../linnworks/dto/order.dto';
import { CreateZohoCustomerParams } from '../types/zoho-books-types';

// Safe getter helpers
const safe = (s?: string) => (typeof s === 'string' ? s : '');
const trimOr = (s?: string, fallback = '') => safe(s).trim() || fallback;

function constructContactName(order: OrderDto): string {
  const full = trimOr(order.CustomerInfo?.Address?.FullName);
  const company = trimOr(order.CustomerInfo?.Address?.Company);
  if (full && company) return `${full} (${company})`;
  return full || company || `Customer ${order.OrderId}`;
}

function toZohoAddress(addr: OrderDto['CustomerInfo']['Address']): {
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
} {
  return {
    address: trimOr(addr?.Address1),
    street2: trimOr(addr?.Address2) || trimOr(addr?.Address3),
    city: trimOr(addr?.Town),
    state: trimOr(addr?.Region),
    zip: trimOr(addr?.PostCode),
    country: trimOr(addr?.Country),
    phone: trimOr(addr?.PhoneNumber),
  };
}

export function buildCreateZohoCustomerParams(
  order: OrderDto,
): CreateZohoCustomerParams {
  const contact_name = constructContactName(order);
  const email = trimOr(order.CustomerInfo?.Address?.EmailAddress);
  const phone = trimOr(order.CustomerInfo?.Address?.PhoneNumber);

  // Billing vs Shipping – prefer explicit BillingAddress if present; otherwise reuse Address
  const billingSource =
    order.CustomerInfo?.BillingAddress || order.CustomerInfo?.Address;
  const shippingSource =
    order.CustomerInfo?.Address || order.CustomerInfo?.BillingAddress;

  const billing_address = {
    attention: contact_name,
    ...toZohoAddress(billingSource),
  };

  const shipping_address = {
    attention: contact_name,
    ...toZohoAddress(shippingSource),
  };

  // Minimal contact person based on provided data
  const firstLast = trimOr(order.CustomerInfo?.Address?.FullName).split(' ');
  const first_name = firstLast[0] || '';
  const lastname = firstLast.slice(1).join(' ') || '';

  return {
    contact_name,
    company_name: trimOr(order.CustomerInfo?.Address?.Company),
    first_name,
    lastname,
    email,
    phone,
    billing_address,
    shipping_address,
    contact_persons:
      email || phone
        ? [
            {
              first_name,
              last_name: lastname,
              email: email || undefined,
              phone: phone || undefined,
            },
          ]
        : [],
    custom_fields: [],
  };
}
