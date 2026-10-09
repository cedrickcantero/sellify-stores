import { asc } from "drizzle-orm";
import { db } from "./db";
import { deviceModel } from "./schema";

export type DeviceModel = {
  id: string;
  brand: string;
  name: string;
  storageOptions: string[];
};

// The global device catalog is shared by every shop and is read-only at
// runtime, so it is not tenant-scoped.
export const deviceCatalog = {
  async list(): Promise<DeviceModel[]> {
    return db
      .select({
        id: deviceModel.id,
        brand: deviceModel.brand,
        name: deviceModel.name,
        storageOptions: deviceModel.storageOptions,
      })
      .from(deviceModel)
      .orderBy(asc(deviceModel.brand), asc(deviceModel.name));
  },
};
