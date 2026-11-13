import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'certs');

const sh = (args, cwd = dir) => execFileSync('openssl', args, { cwd, stdio: 'pipe' });

export function testCerts() {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, 'chain.pem'))) {
    sh(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'root.key']);
    sh(['req', '-x509', '-new', '-key', 'root.key', '-sha256', '-days', '365', '-subj', '/CN=Agora Test Root CA/O=Agora Spike',
      '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', 'root.pem']);
    sh(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.sec1.key']);
    sh(['pkcs8', '-topk8', '-nocrypt', '-in', 'leaf.sec1.key', '-out', 'leaf.key']);
    sh(['req', '-new', '-key', 'leaf.key', '-subj', '/CN=Agora Test Signer/O=Agora Spike', '-out', 'leaf.csr']);
    writeFileSync(join(dir, 'leaf.ext'),
      'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n');
    sh(['x509', '-req', '-in', 'leaf.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '90', '-sha256', '-extfile', 'leaf.ext', '-out', 'leaf.pem']);
    writeFileSync(join(dir, 'chain.pem'), readFileSync(join(dir, 'leaf.pem'), 'utf8') + readFileSync(join(dir, 'root.pem'), 'utf8'));
  }
  return { cert: readFileSync(join(dir, 'chain.pem')), key: readFileSync(join(dir, 'leaf.key')), rootPem: readFileSync(join(dir, 'root.pem'), 'utf8') };
}
