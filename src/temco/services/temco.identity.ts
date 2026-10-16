/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../vs/nls.js';
import { InstantiationType, registerSingleton } from '../../vs/platform/instantiation/common/extensions.js';
import { createDecorator } from '../../vs/platform/instantiation/common/instantiation.js';
import { IProductService } from '../../vs/platform/product/common/productService.js';
import { TEMCO_PLATFORM_TITLE } from '../platform/temco.ids.js';

/**
 * The shell's knowledge of what this application is.
 *
 * The name and the version come from `product.json`, so branding is one file to edit and every
 * surface that names the product reads it from here rather than from a literal.
 */
export const ITemcoIdentityService = createDecorator<ITemcoIdentityService>('temcoIdentityService');

export interface ITemcoIdentityService {

	readonly _serviceBrand: undefined;

	/** The application's display name. */
	readonly name: string;

	/** The version being run. */
	readonly version: string;

	/** The product and its version on one line, for a dialog. */
	summary(): string;
}

class TemcoIdentityService implements ITemcoIdentityService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IProductService private readonly productService: IProductService
	) { }

	get name(): string {
		return this.productService.nameLong || TEMCO_PLATFORM_TITLE;
	}

	get version(): string {
		return this.productService.version;
	}

	summary(): string {
		return localize('temco.summary', "{0} {1}", this.name, this.version);
	}
}

registerSingleton(ITemcoIdentityService, TemcoIdentityService, InstantiationType.Delayed);
