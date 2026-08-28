import express from 'express';
import fs from 'fs';
import plist from 'simple-plist';
import IRestore from 'irestore';
import tmp from 'tmp';
import path from 'path';
import cors from 'cors';
import { keychainItemMap, removeItems, undecryptableItems } from './keychain.js';

const port = 0;
const app = express();

app.use(cors());
app.use(express.json());

app.use(function (req, res, next) {
  if (!req.body.path || !req.body.password) {
    return res.status(400).send('Missing path or password');
  }
  if (!fs.existsSync(req.body.path)) {
    return res.status(400).send('Backup path does not exist');
  }
  next();
});

app.post('/decrypt', async (req, res) => {
  const tempDir = tmp.dirSync({ unsafeCleanup: true });

  // Dump Keychain
  const iRestore = new IRestore(req.body.path, req.body.password);
  try {
    await iRestore.dumpKeys(path.join(tempDir.name, 'keys.json'));
    await iRestore.restore('KeychainDomain', path.join(tempDir.name, 'KeychainDomain'));
  } catch (error) {
    return res.status(500).send(`irestore error: ${error}`);
  }

  // Decrypt Keychain and partial Keychain
  const keychain = await plist.readFileSync(path.join(tempDir.name, path.join('KeychainDomain', 'keychain-backup.plist')));
  const partialDecryptedKeychain = JSON.parse(fs.readFileSync(path.join(tempDir.name, 'keys.json')));

  // Create JSON payload
  const payload = {};
  for (const [key, value] of Object.entries(keychainItemMap)) {
    payload[key] = {
      total: keychain[key]?.length || 0,
      items: [],
      undecryptable: undecryptableItems(key, keychain[key], partialDecryptedKeychain[value]),
    };
    partialDecryptedKeychain[value]?.forEach(item => {
      const ignoredKeys = Object.keys(item).filter(key => key[0] === '_');
      ignoredKeys.forEach(ignoredKey => {
        delete item[ignoredKey];
      });
      payload[key]['items'].push(item);
    });
  }

  tempDir.removeCallback();
  res.send(payload);
});

app.post('/update', async (req, res) => {
  const tempDir = tmp.dirSync({ unsafeCleanup: true });
  const updatedItems = JSON.parse(req.body.items || '[]');
  const deletedItems = JSON.parse(req.body.deletedItems || '[]');

  // Dump Keychain, decrypting it is only needed to edit items
  const iRestore = new IRestore(req.body.path, req.body.password);
  try {
    if (updatedItems.length > 0) {
      await iRestore.dumpKeys(path.join(tempDir.name, 'keys.json'));
    }
    await iRestore.restore('KeychainDomain', path.join(tempDir.name, 'KeychainDomain'));
  } catch (error) {
    return res.status(500).send(`irestore error: ${error}`);
  }

  // Load Keychain
  const updatedKeychainPath = path.join(tempDir.name, path.join('KeychainDomain', 'keychain-backup.plist'));
  const keychain = await plist.readFileSync(updatedKeychainPath);

  if (updatedItems.length > 0) {
    const partialDecryptedKeychain = JSON.parse(fs.readFileSync(path.join(tempDir.name, 'keys.json')));

    // Update partial decrypted Keychain
    updatedItems.forEach(update => {
      Object.values(keychainItemMap).forEach(value => {
        partialDecryptedKeychain[value]?.forEach((item, index) => {
          if (item.persistref === update.persistref) {
            for (const [k, v] of Object.entries(update)) {
              partialDecryptedKeychain[value][index][k] = v;
            }
          }
        });
      });
    });

    fs.writeFileSync(path.join(tempDir.name, 'keys-updated.json'), JSON.stringify(partialDecryptedKeychain, null, 2));

    // Encrypt partial Keychain
    await iRestore.encryptKeys(path.join(tempDir.name, 'keys-updated.json'), path.join(tempDir.name, 'keys-updated.plist'));
    const partialKeychain = await plist.readFileSync(path.join(tempDir.name, 'keys-updated.plist'));

    // Update Keychain
    Object.keys(keychainItemMap).forEach(key => {
      keychain[key]?.forEach(item => {
        updatedItems.forEach(update => {
          const persistentRefWithType = btoa(key + atob(update.persistref));
          if (item.v_PersistentRef.toString('base64') === persistentRefWithType) {
            partialKeychain[key].forEach(updatedItem => {
              if (updatedItem.v_PersistentRef.toString('base64') === persistentRefWithType) {
                item.v_Data = updatedItem.v_Data;
              }
            });
          }
        });
      });
    });
  }

  // Remove deleted Keychain items
  removeItems(keychain, deletedItems);

  // Save Keychain
  plist.writeBinaryFileSync(updatedKeychainPath, keychain);
  const updatedKeychainPlist = fs.readFileSync(updatedKeychainPath);
  res.setHeader('Content-Disposition', 'attachment; filename=keychain-backup.plist');
  res.send(updatedKeychainPlist);
  tempDir.removeCallback();
});

const server = app.listen(port, () => {
  fs.writeFileSync('port.ts', `export default ${server.address().port};`);
});
