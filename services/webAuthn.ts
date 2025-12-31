
/**
 * WebAuthn implementation for biometric unlock.
 * Note: Browser-side local attestation. 
 */

const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const uint8ArrayToBase64 = (array: Uint8Array) => {
  let binary = '';
  const len = array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return window.btoa(binary);
};

export const webAuthnService = {
  isSupported: async () => {
    return (
      window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  },

  registerBiometrics: async (username: string) => {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const options: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "Couple Expense Tracker",
        id: window.location.hostname || "localhost",
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = (await navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential;

    if (!credential) throw new Error("Credential creation failed");

    return {
      credentialId: uint8ArrayToBase64(new Uint8Array(credential.rawId)),
    };
  },

  authenticateBiometrics: async (credentialIdBase64: string) => {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credentialId = base64ToUint8Array(credentialIdBase64);

    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [
        {
          id: credentialId,
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: options,
    })) as PublicKeyCredential;

    if (!assertion) throw new Error("Authentication failed");

    return true;
  },
};
