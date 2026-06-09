module.exports = function (self) {
	self.setActionDefinitions({
		route_afv: {
			name: 'Route input to output on all levels',
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
			],
			callback: async (event) => {
				const output = Number.parseInt(event.options.output, 10)
				const input = String(event.options.input).trim()
				self.log('debug', `Action route_afv output=${output} input=${input}`)
				self.sendRouteCommand('Y', output, input)
			},
		},
		route_level: {
			name: 'Route input to output on a level',
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
					id: 'level',
					type: 'number',
					label: 'Level',
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
			],
			callback: async (event) => {
				const output = Number.parseInt(event.options.output, 10)
				const level = Number.parseInt(event.options.level, 10)
				const input = String(event.options.input).trim()
				self.log('debug', `Action route_level output=${output} level=${level} input=${input}`)
				self.sendRouteCommand('X', output, input, level)
			},
		},
		route_levels: {
			name: 'Route multiple levels to output',
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
					id: 'inputs',
					type: 'textinput',
					label: 'Inputs by level',
					default: '1,1',
					tooltip: 'Comma-separated input list. Use 0 to leave a level unchanged and - to disconnect a level.',
				},
			],
			callback: async (event) => {
				const output = Number.parseInt(event.options.output, 10)
				const inputs = String(event.options.inputs)
					.split(',')
					.map((item) => item.trim())
				self.log('debug', `Action route_levels output=${output} inputs=${inputs.join('|')}`)
				self.sendRouteCommand('V', output, inputs)
			},
		},
		trigger_salvo: {
			name: 'Trigger salvo',
			options: [
				{
					id: 'salvo',
					type: 'number',
					label: 'Salvo',
					default: 1,
					min: 1,
					max: 256,
				},
			],
			callback: async (event) => {
				const salvo = Number.parseInt(event.options.salvo, 10)
				self.log('debug', `Action trigger_salvo salvo=${salvo}`)
				self.sendRaw(`T${salvo}`)
			},
		},
		refresh_status: {
			name: 'Refresh status',
			options: [],
			callback: async () => {
				self.log('debug', 'Action refresh_status')
				self.sendRaw('S')
				self.sendRaw('L')
				self.sendRaw('Q')
			},
		},
	})
}
