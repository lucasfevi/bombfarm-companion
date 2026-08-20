export interface AppIdentityPort {
  setName(name: string): void;
  setAppUserModelId(id: string): void;
  setPath(name: 'userData', path: string): void;
  requestSingleInstanceLock(): boolean;
}

export interface AppIdentityInput {
  productName: string;
  appId: string;
  userDataPath: string;
}

export function applyAppIdentity(
  port: AppIdentityPort,
  input: AppIdentityInput,
): { gotLock: boolean } {
  port.setName(input.productName);
  port.setAppUserModelId(input.appId);
  port.setPath('userData', input.userDataPath);
  const gotLock = port.requestSingleInstanceLock();
  return { gotLock };
}
