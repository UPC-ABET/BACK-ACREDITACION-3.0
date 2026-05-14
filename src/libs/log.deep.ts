// libs/logger.ts
import { inspect } from 'util';

export const logDeep = (label: string, data: any) => {
	console.log(
		label,
		inspect(data, {
			depth: null,
			colors: true,
			maxArrayLength: null,
		}),
	);
};
