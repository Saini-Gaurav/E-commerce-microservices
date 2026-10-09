import { Request, Response } from "express";
import * as addressService from "../services/address.service";
import { handleServiceError } from "../utils/errors";

export async function listAddressesHandler(req: Request, res: Response): Promise<void> {
  try {
    const addresses = await addressService.listAddresses(req.user!.userId);
    res.status(200).json({ addresses });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function createAddressHandler(req: Request, res: Response): Promise<void> {
  try {
    const address = await addressService.createAddress(req.user!.userId, req.body);
    res.status(201).json({ address });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function setDefaultAddressHandler(req: Request, res: Response): Promise<void> {
  try {
    await addressService.setDefaultAddress(req.user!.userId, req.params.id);
    res.status(200).json({ message: "Default address updated" });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function deleteAddressHandler(req: Request, res: Response): Promise<void> {
  try {
    await addressService.deleteAddress(req.user!.userId, req.params.id);
    res.status(200).json({ message: "Address deleted" });
  } catch (err) {
    handleServiceError(err, res);
  }
}