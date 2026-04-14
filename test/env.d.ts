declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {}
}

declare module "*.rdf?raw" {
	const content: string;
	export default content;
}
