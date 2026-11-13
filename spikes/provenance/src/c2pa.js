import { Builder, Reader, LocalSigner, Context } from '@contentauth/c2pa-node';
import { testCerts } from './certs.js';

export async function attach(jpeg, { did, handle }) {
  const { cert, key } = testCerts();
  const signer = LocalSigner.newSigner(cert, key, 'es256');
  const builder = await Builder.withJsonAsync({
    claim_generator_info: [{ name: 'agora-spike', version: '0.0.1' }],
    title: 'upload.jpg',
    assertions: [
      { label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.created', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture' }] } },
      { label: 'stds.schema-org.CreativeWork', data: { '@context': 'https://schema.org', '@type': 'CreativeWork', author: [{ '@type': 'Person', identifier: did, name: handle }] } },
    ],
  });
  const output = { buffer: null };
  builder.sign(signer, { buffer: jpeg, mimeType: 'image/jpeg' }, output);
  return output.buffer;
}

export async function verify(jpeg, { trustAnchorsPem } = {}) {
  const ctx = new Context({ verify: { verifyTrust: Boolean(trustAnchorsPem) }, ...(trustAnchorsPem ? { trust: { trustAnchors: trustAnchorsPem } } : {}) });
  const reader = await Reader.fromAsset({ buffer: jpeg, mimeType: 'image/jpeg' }, ctx);
  const m = reader.getActive();
  const json = reader.json();
  return {
    activeLabel: json.active_manifest,
    signer: m?.signature_info?.issuer ?? null,
    validationState: json.validation_state ?? null,
    failures: json.validation_results?.activeManifest?.failure ?? [],
    successCodes: (json.validation_results?.activeManifest?.success ?? []).map((x) => x.code),
    informational: (json.validation_results?.activeManifest?.informational ?? []).map((x) => x.code),
    author: m?.assertions?.find((a) => a.label === 'stds.schema-org.CreativeWork')?.data?.author?.[0]?.identifier ?? null,
  };
}
