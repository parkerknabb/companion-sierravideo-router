module.exports = function (self) {
	const definitions = {
		router_model: { name: 'Router model' },
		router_version: { name: 'Router version' },
		router_outputs: { name: 'Output count' },
		router_inputs: { name: 'Input count' },
		router_levels: { name: 'Level count' },
		router_capabilities: { name: 'Capabilities' },
		router_update_mode: { name: 'Update mode' },
		router_level_names: { name: 'Level names' },
	}

	for (let level = 1; level <= self.levelCount; level++) {
		definitions[`router_level_name_${level}`] = { name: `Level ${level} name` }
	}

	for (let output = 1; output <= self.outputCount; output++) {
		for (let level = 1; level <= self.levelCount; level++) {
			definitions[`output_${output}_level_${level}`] = {
				name: `Output ${output} level ${level}`,
			}
		}
	}

	self.setVariableDefinitions(definitions)
}
