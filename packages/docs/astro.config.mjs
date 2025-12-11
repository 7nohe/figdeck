// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { SITE } from './src/consts';

// https://astro.build/config
export default defineConfig({
	site: SITE.url,
	integrations: [
		starlight({
			title: SITE.title,
			description: SITE.description,
			favicon: '/favicon.svg',
			customCss: ['./src/styles/custom.css'],
			head: [
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: SITE.ogImage,
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:width',
						content: String(SITE.ogImageWidth),
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:height',
						content: String(SITE.ogImageHeight),
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:card',
						content: 'summary_large_image',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image',
						content: SITE.ogImage,
					},
				},
			],
			defaultLocale: 'en',
			locales: {
				en: {
					label: 'English',
					lang: 'en',
				},
				ja: {
					label: '日本語',
					lang: 'ja',
				},
			},
			social: [
				{
					label: 'GitHub',
					icon: 'github',
					href: 'https://github.com/7nohe/figdeck',
				},
			],
			sidebar: [
				{
					label: 'Overview',
					link: '/',
				},
				{
					label: 'Getting Started',
					items: [
						{ label: 'Installation', link: '/getting-started/installation/' },
						{ label: 'Plugin Setup', link: '/plugin-setup/' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Markdown Syntax', link: '/markdown-spec/' },
						{ label: 'Architecture', link: '/architecture/' },
						{ label: 'API Reference', link: '/api-reference/' },
					],
				},
				{
					label: 'Release Notes',
					link: '/release-notes/',
				},
			],
		}),
	],
});
