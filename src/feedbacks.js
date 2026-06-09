module.exports = async function (self) {
	self.setFeedbackDefinitions({
		route_matches: {
			name: 'Output matches input',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0x008000,
				color: 0xffffff,
			},
			options: [
				{
					id: 'output',
					type: 'number',
					label: 'Output',
					default: 1,
					min: 1,
					max: 9999,
				},
				{
					id: 'input',
					type: 'textinput',
					label: 'Input',
					default: '1',
				},
				{
					id: 'level',
					type: 'number',
					label: 'Level',
					default: 0,
					min: 0,
					max: 9999,
				},
			],
			callback: (feedback) => {
				const output = Number.parseInt(feedback.options.output, 10)
				const input = String(feedback.options.input).trim()
				const level = Number.parseInt(feedback.options.level, 10)
				const levelsToCheck =
					level === 0 ? self.levelCount || Object.keys(self.crosspoints[output] || {}).length || 1 : 1

				for (let i = 0; i < levelsToCheck; i++) {
					const currentLevel = level === 0 ? i + 1 : level
					const currentInput = self.getCrosspoint(output, currentLevel)
					if (String(currentInput ?? '') !== input) {
						return false
					}
				}

				return true
			},
		},
	})
}
