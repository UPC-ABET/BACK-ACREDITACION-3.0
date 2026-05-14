import { decrypt } from './encrypt';

export async function getParsedParameter(param: any): Promise<string> {
	if (!param) throw new Error('Parametro no configurado');

	let value = param.is_encrypted ? decrypt(param.value) : param.value;
	value = param.is_json ? JSON.parse(value) : value;

	return value;
}
