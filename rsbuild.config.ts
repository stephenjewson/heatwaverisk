import { defineConfig } from "@rsbuild/core";
import { pluginImageCompress } from "@rsbuild/plugin-image-compress";
import { pluginHtmlMinifierTerser } from "rsbuild-plugin-html-minifier-terser";

export default defineConfig({
	html: {
		template: "src/index.ejs",
		title: "Heat Wave Risk",
		meta: {
			author: "Stephen Jewson",
			description: "Heat wave risk info",
			keywords: "climate,heat wave",
			"color-scheme": "light",
		},
		tags: [
			{
				tag: "link",
				attrs: {
					rel: "canonical",
					href: "https://heatwaverisk.info/",
				},
			},
		],
	},
	tools: {
		rspack: {
			module: {
				rules: [{ test: /\.csv$/, type: "asset/source" }],
			},
		},
	},
	plugins: [pluginHtmlMinifierTerser(), pluginImageCompress(["svg"])],
});
