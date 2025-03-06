// Validation functions for Ethereum addresses and private keys

/**
 * Validates an Ethereum private key
 * @param key The private key to validate
 * @returns An object with isValid boolean and error message if invalid
 */
export function validatePrivateKey(key: string): { isValid: boolean; error?: string } {
    if (!key || key.trim() === "") {
      return { isValid: false, error: "Private key cannot be empty" }
    }
  
    // Remove 0x prefix if present
    const cleanKey = key.startsWith("0x") ? key.slice(2) : key
  
    // Check length (should be 64 hex characters)
    if (cleanKey.length !== 64) {
      return { isValid: false, error: "Private key must be 64 hexadecimal characters (or 66 with '0x' prefix)" }
    }
  
    // Check if it contains only valid hex characters
    const hexRegex = /^[0-9a-fA-F]+$/
    if (!hexRegex.test(cleanKey)) {
      return { isValid: false, error: "Private key must contain only hexadecimal characters (0-9, a-f, A-F)" }
    }
  
    return { isValid: true }
  }
  
  /**
   * Validates an Ethereum address
   * @param address The address to validate
   * @returns An object with isValid boolean and error message if invalid
   */
  export function validateEthereumAddress(address: string): { isValid: boolean; error?: string } {
    if (!address || address.trim() === "") {
      return { isValid: false, error: "Address cannot be empty" }
    }
  
    // Check if it starts with 0x
    if (!address.startsWith("0x")) {
      return { isValid: false, error: "Ethereum address must start with '0x'" }
    }
  
    // Check length (should be 42 characters including 0x prefix)
    if (address.length !== 42) {
      return { isValid: false, error: "Ethereum address must be 42 characters long (including '0x' prefix)" }
    }
  
    // Check if it contains only valid hex characters after 0x
    const hexRegex = /^0x[0-9a-fA-F]+$/
    if (!hexRegex.test(address)) {
      return { isValid: false, error: "Ethereum address must contain only hexadecimal characters (0-9, a-f, A-F)" }
    }
  
    return { isValid: true }
  }
  
  