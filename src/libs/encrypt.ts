import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256').update(process.env.APP_SECRET!).digest();

export function encrypt(text: string): string {
	const iv = crypto.randomBytes(16);

	const cipher = crypto.createCipheriv(algorithm, key, iv);

	const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

	return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
	const [ivHex, encryptedHex] = text.split(':');

	const iv = Buffer.from(ivHex, 'hex');
	const encryptedText = Buffer.from(encryptedHex, 'hex');

	const decipher = crypto.createDecipheriv(algorithm, key, iv);

	const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

	return decrypted.toString('utf8');
}
