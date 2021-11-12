// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const hl7v271 = require('hl7-dictionary').definitions['2.7.1'];

const parseLine = (line) => {
	let channelOutput = '';
	const tokens = line.split('|');
	const segment = tokens[0];
	const segmentDef = hl7v271.segments[segment];

	if(!segmentDef) {
		return `${line} - Custom segment`;
	}

	if (segment === 'MSH') {
		tokens.splice(1, 0, '|');
	}

	const output = [{ segment: segment + '-0', desc: segment, values: [segment] }];
	let maxLength = 0;
	for (let i = 1; i <= segmentDef.fields.length; i++) {
		const desc = segmentDef.fields[i - 1].desc;
		maxLength = Math.max(maxLength, desc.length);

		const values = [];
		if (i < tokens.length) {
			if (segment === 'MSH' && i === 2) {
				values.push(tokens[i]);
			} else {
				const subTokens = tokens[i].split('^');
				for (const subToken of subTokens) {
					values.push(subToken);
				}
			}
		}

		output.push({
			segment: segment + '-' + i,
			desc: desc,
			values: values
		})
	}

	for (const outputItem of output) {
		const prefix = (outputItem.segment + ':').padEnd(8, ' ') +
			(outputItem.desc + ':').padEnd(maxLength, ' ') +
			' ';

		let value = '';
		if (outputItem.values.length === 1) {
			if (outputItem.values[0].length > 0) {
				value += outputItem.values[0];
			}
		} else {
			for (let j = 0; j < outputItem.values.length; j++) {
				if (outputItem.values[j].length > 0) {
					value += ('\n  ' + outputItem.segment + '-' + (j + 1) + ':').padEnd(prefix.length + 1, ' ');
					value += outputItem.values[j];
				}
			}
		}
		if (value) {
			channelOutput += prefix + value + '\n';
		}
	}
	return channelOutput;
}

const modes = {
	line: 'line',
	document: 'document'
};

const tokenize = function (mode) {
	// The code you place here will be executed every time your command is executed

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return; // No open text editor
	}

	const currentDoc = editor.document;
	const lines = [];
	let channelOutput = '';
	switch (mode) {
		case modes.line:
			{
				const selection = editor.selection;
				const currentLineNum = selection.start.line;
				let lineText = currentDoc.lineAt(currentLineNum).text.trim();
				if (lineText.length > 4) {
					if (/^\w{3}\|/.test(lineText)) {
						lines.push(lineText);
					} else if (lineText.length > 10) {
						// check for part of JSON document
						if (lineText.endsWith(',')) {
							lineText = lineText.substring(0, lineText.length - 1);
						}
						try {
							const jsonText = JSON.parse(`{${lineText}}`);
							for (const key in jsonText) {
								const value = jsonText[key].trim();
								if (value.length > 0) {
									lines.push(...value.split('\r'));
								}
							}
						} catch (err) {
							channelOutput += 'Unexpected data';
						}
					}
				}
			}
			break;
		case modes.document:
			{
				for (let line = 0; line < currentDoc.lineCount; line++) {
					lines.push(currentDoc.lineAt(line).text);
				}
			}
			break;
	}

	if (lines && lines.length > 0) {
		const lineOutputs = [];
		for (const line of lines) {
			const trimmedLine = line.trim();
			if (trimmedLine.length > 1) {
				lineOutputs.push(parseLine(trimmedLine));
			}
		}
		channelOutput = lineOutputs.join('\r\n');
	}

	const channel = vscode.window.createOutputChannel('HL7 Tokens');
	channel.clear();
	channel.appendLine(channelOutput);
	channel.show(vscode.ViewColumn.Two);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "s4t-hl7" is now active!');



	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json

	context.subscriptions.push(vscode.commands.registerCommand('s4t-hl7.tokenizeHl7Line', () => tokenize(modes.line)));
	context.subscriptions.push(vscode.commands.registerCommand('s4t-hl7.tokenizeHl7Document', () => tokenize(modes.document)));
}

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
