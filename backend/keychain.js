// Keychain item classes of keychain-backup.plist mapped to the section names
// used by the JSON that irestore dumps.
export const keychainItemMap = {
  cert: 'Certs',
  genp: 'General',
  inet: 'Internet',
  keys: 'Keys',
};

// Keybag protection classes. The ThisDeviceOnly class keys are not part of the
// backup keybag as they are wrapped with the hardware 0x835 key of the device,
// items protected by them can therefore only be deleted, not edited.
const protectionClasses = {
  6: 'WhenUnlocked',
  7: 'AfterFirstUnlock',
  8: 'Always',
  9: 'WhenUnlockedThisDeviceOnly',
  10: 'AfterFirstUnlockThisDeviceOnly',
  11: 'AlwaysThisDeviceOnly',
};

// An encrypted Keychain item is version|protection class|wrapped key length|wrapped key|ciphertext,
// only the ciphertext is encrypted so the protection class is readable without the class key.
export function protectionClass(item) {
  if (!Buffer.isBuffer(item.v_Data) || item.v_Data.length < 12) {
    return undefined;
  }
  return protectionClasses[item.v_Data.readUInt32LE(4)];
}

// The persistent reference of a keychain-backup.plist item is the four character
// item class followed by the persistent reference of the item itself.
export function persistentRef(item) {
  return Buffer.isBuffer(item.v_PersistentRef) ? item.v_PersistentRef.toString('base64') : undefined;
}

export function itemPersistentRef(item) {
  return Buffer.isBuffer(item.v_PersistentRef) ? item.v_PersistentRef.subarray(4).toString('base64') : undefined;
}

export function persistentRefWithType(type, persistref) {
  return persistref ? btoa(type + atob(persistref)) : undefined;
}

// Keychain items which irestore was unable to decrypt with the backup password.
export function undecryptableItems(type, items = [], decryptedItems = []) {
  const decryptedRefs = new Set(decryptedItems.map(item => persistentRefWithType(type, item.persistref)));
  return items
    .filter(item => !decryptedRefs.has(persistentRef(item)))
    .map(item => ({
      persistref: itemPersistentRef(item),
      protectionClass: protectionClass(item),
    }));
}

// Removes Keychain items from a keychain-backup.plist by persistent reference.
export function removeItems(keychain, persistrefs) {
  Object.keys(keychainItemMap).forEach(type => {
    if (!keychain[type]) {
      return;
    }
    const refs = new Set(persistrefs.map(persistref => persistentRefWithType(type, persistref)));
    keychain[type] = keychain[type].filter(item => !refs.has(persistentRef(item)));
  });
}
