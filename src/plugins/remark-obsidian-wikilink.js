/**
 * Remark plugin: converts Obsidian `![[filename.ext]]` wikilinks
 * to standard markdown `![filename](/assets/images/posts/filename.ext)`
 */
export function remarkObsidianWikilink() {
	return (tree) => {
		function walk(nodes) {
			let i = 0;
			while (i < nodes.length) {
				const node = nodes[i];
				if (node.type === "text") {
					const regex = /!\[\[([^[\]]+\.\w+)\]\]/g;
					if (regex.test(node.value)) {
						regex.lastIndex = 0;
						const parts = [];
						let lastIndex = 0;
						let match;
						match = regex.exec(node.value);
						while (match !== null) {
							if (match.index > lastIndex) {
								parts.push({
									type: "text",
									value: node.value.slice(lastIndex, match.index),
								});
							}
							const filename = match[1];
							parts.push({
								type: "image",
								url: `/assets/images/posts/${encodeURI(filename)}`,
								alt: filename.replace(/\.[^.]+$/, ""),
							});
							lastIndex = regex.lastIndex;
							match = regex.exec(node.value);
						}
						if (lastIndex < node.value.length) {
							parts.push({ type: "text", value: node.value.slice(lastIndex) });
						}
						nodes.splice(i, 1, ...parts);
						i += parts.length;
						continue;
					}
				}
				if (node.children) {
					walk(node.children);
				}
				i++;
			}
		}
		walk(tree.children);
	};
}
