import {
  findAddressesByUserId,
  countAddressesByUserId,
  findAddressById,
  createAddress as createAddressInDb,
  setDefaultAddress as setDefaultAddressInDb,
  deleteAddress as deleteAddressInDb,
  AddressRow,
} from "../repositories/address.repository";
import { ServiceError } from "../utils/errors";

const MAX_ADDRESSES_PER_USER = 10;
const VALID_LABELS = ["Home", "Work", "Other"];

export interface AddressResponse {
  id: string;
  label: string;
  shippingAddress1: string;
  shippingAddress2: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

function toAddressResponse(row: AddressRow): AddressResponse {
  return {
    id: row.id,
    label: row.label,
    shippingAddress1: row.shipping_address1,
    shippingAddress2: row.shipping_address2,
    city: row.city,
    zip: row.zip,
    country: row.country,
    phone: row.phone,
    isDefault: row.is_default,
  };
}

// 404 rather than 403 for someone else's address, same reasoning as
// getOrderById: don't confirm the id exists to a non-owner.
async function getOwnedAddress(userId: string, id: string): Promise<AddressRow> {
  const row = await findAddressById(id);
  if (!row || row.user_id !== userId) {
    throw new ServiceError("Address not found", 404);
  }
  return row;
}

export async function listAddresses(userId: string): Promise<AddressResponse[]> {
  const rows = await findAddressesByUserId(userId);
  return rows.map(toAddressResponse);
}

export async function createAddress(
  userId: string,
  input: {
    label: string;
    shippingAddress1: string;
    shippingAddress2?: string;
    city: string;
    zip: string;
    country: string;
    phone: string;
  }
): Promise<AddressResponse> {
  const label = input.label || "Home";
  if (!VALID_LABELS.includes(label)) {
    throw new ServiceError(`label must be one of: ${VALID_LABELS.join(", ")}`, 400);
  }

  const shippingAddress1 = input.shippingAddress1?.trim();
  const city = input.city?.trim();
  const zip = input.zip?.trim();
  const country = input.country?.trim();
  const phone = input.phone?.trim();
  if (!shippingAddress1 || !city || !zip || !country || !phone) {
    throw new ServiceError("shippingAddress1, city, zip, country, and phone are required", 400);
  }

  const existingCount = await countAddressesByUserId(userId);
  if (existingCount >= MAX_ADDRESSES_PER_USER) {
    throw new ServiceError(`You can save up to ${MAX_ADDRESSES_PER_USER} addresses`, 400);
  }

  const row = await createAddressInDb(
    userId,
    {
      label,
      shippingAddress1,
      shippingAddress2: input.shippingAddress2?.trim() ?? "",
      city,
      zip,
      country,
      phone,
    },
    existingCount === 0 // first saved address becomes the default
  );
  return toAddressResponse(row);
}

export async function setDefaultAddress(userId: string, id: string): Promise<void> {
  await getOwnedAddress(userId, id);
  await setDefaultAddressInDb(id, userId);
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  await getOwnedAddress(userId, id);
  await deleteAddressInDb(id, userId);
}