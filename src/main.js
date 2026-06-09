const net = require('node:net')
const { InstanceBase, Regex, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.socket = null
		this.buffer = ''
		this.connected = false
		this.capabilities = ''
		this.updateMode = ''
		this.modelName = ''
		this.versionString = ''
		this.outputCount = 0
		this.inputCount = 0
		this.levelCount = 0
		this.levelNames = []
		this.crosspoints = {}
	}

	async init(config) {
		this.config = this.normalizeConfig(config)
		this.log('debug', 'Initializing Sierra Aspen module')

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.connect()
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
		this.disconnect()
	}

	async configUpdated(config) {
		this.config = this.normalizeConfig(config)
		this.log('debug', 'Configuration updated, reconnecting')
		this.connect()
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'targetIp',
				label: 'Target IP Address',
				width: 8,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'targetPort',
				label: 'Target Port',
				width: 4,
				regex: Regex.PORT,
				default: 10001,
			},
		]
	}

	normalizeConfig(config) {
		return {
			targetIp: config?.targetIp ?? config?.host ?? '',
			targetPort: Number.parseInt(config?.targetPort ?? config?.port, 10) || 10001,
		}
	}

	connect() {
		this.disconnect()

		if (!this.config.targetIp) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing target IP')
			return
		}

		this.updateStatus(
			InstanceStatus.Connecting,
			`Connecting to ${this.config.targetIp}:${this.config.targetPort}`
		)

		const socket = net.createConnection(
			{
				host: this.config.targetIp,
				port: this.config.targetPort,
			},
			() => {
				if (socket !== this.socket) return

				this.connected = true
				this.updateStatus(InstanceStatus.Ok)
				this.log('debug', `Connected to ${this.config.targetIp}:${this.config.targetPort}`)

				// Query capabilities, routing size, and current routing state.
				this.sendRaw('I')
				this.sendRaw('Q')
				this.sendRaw('L')
				this.sendRaw('S')
				// Turn on automatic routing change reports.
				this.sendRaw('U1')
				this.checkAllFeedbacks()
			}
		)

		this.socket = socket
		socket.setNoDelay(true)

		socket.on('data', (data) => {
			if (socket !== this.socket) return
			this.handleData(data)
		})

		socket.on('error', (err) => {
			if (socket !== this.socket) return
			this.log('error', `Connection error: ${err.message}`)
			this.updateStatus(InstanceStatus.UnknownError, err.message)
		})

		socket.on('close', () => {
			if (socket !== this.socket) return

			this.log('debug', 'Connection closed')
			this.socket = null
			this.connected = false
			this.updateStatus(InstanceStatus.Disconnected)
		})
	}

	disconnect() {
		if (this.socket) {
			const socket = this.socket
			this.socket = null
			this.connected = false
			socket.destroy()
		}
	}

	sendRaw(command) {
		if (!this.socket || !this.connected) {
			this.log('warn', `Cannot send ${command} because the router is not connected`)
			return
		}

		this.log('debug', `TX **${command}!!`)
		this.socket.write(`**${command}!!`)
	}

	sendRouteCommand(command, output, input, level = null) {
		if (!this.socket || !this.connected) {
			this.log('warn', `Cannot send ${command} command because the router is not connected`)
			return
		}

		let commandString = command
		if (command === 'X') {
			commandString = `X${output},${input},${level}`
			this.setCrosspoint(output, level, input)
		} else if (command === 'Y') {
			commandString = `Y${output},${input}`
			this.setAfv(output, input)
		} else if (command === 'V') {
			commandString = `V${output},${input.join(',')}`
			this.setMultiLevel(output, input)
		}

		this.log('debug', `TX **${commandString}!!`)
		this.socket.write(`**${commandString}!!`)
	}

	handleData(data) {
		this.buffer += data.toString('ascii')

		while (this.buffer.includes('!!')) {
			const endIndex = this.buffer.indexOf('!!')
			const packet = this.buffer.slice(0, endIndex)
			this.buffer = this.buffer.slice(endIndex + 2)
			this.handlePacket(packet)
		}
	}

	handlePacket(packet) {
		const cleaned = packet.replace(/^\s*\*\*\s*/, '').trim()
		if (!cleaned) return

		this.log('debug', `RX ${cleaned}`)

		if (cleaned.startsWith('Q')) {
			this.parseModelInfo(cleaned.slice(1).replace(/\s+OK$/, ''))
			return
		}

		if (cleaned.startsWith('L')) {
			this.parseLevelInfo(cleaned.slice(1).replace(/\s+OK$/, ''))
			return
		}

		const rawTokens = cleaned.split(/\s+/)
		const tokens = []
		for (let i = 0; i < rawTokens.length; i++) {
			const token = rawTokens[i]
			if (!token || token === 'OK') continue

			if (token.length === 1 && i + 1 < rawTokens.length && rawTokens[i + 1] !== 'OK') {
				tokens.push(`${token}${rawTokens[i + 1]}`)
				i++
				continue
			}

			tokens.push(token)
		}

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i]
			if (!token) continue

			if (token === 'OK') {
				continue
			}

			if (token === 'RESET') {
				this.log('debug', 'Router reported RESET')
				continue
			}

			if (token === 'ERROR') {
				const message = tokens.slice(i + 1).join(' ')
				this.log('error', `Router error: ${message || 'unknown error'}`)
				break
			}

			this.handleCommandToken(token)
		}
	}

	handleCommandToken(token) {
		const type = token[0]
		const payload = token.slice(1)

		switch (type) {
			case 'I':
				this.capabilities = payload.replace(/~/g, '')
				this.updateVariableState()
				break
			case 'Q':
				this.parseModelInfo(payload)
				break
			case 'L':
				this.parseLevelInfo(payload)
				break
			case 'U':
				this.updateMode = payload.trim()
				this.updateVariableState()
				break
			case 'V':
				this.parseVStatus(payload)
				break
			case 'X':
				this.parseXStatus(payload)
				break
			case 'Y':
				this.parseYStatus(payload)
				break
			default:
				this.log('debug', `Unhandled packet token: ${token}`)
				break
		}
	}

	parseModelInfo(payload) {
		const values = payload.split('~')
		this.modelName = (values[0] || '').trim()
		this.versionString = (values[1] || '').trim()
		this.updateVariableState()
	}

	parseLevelInfo(payload) {
		const match = payload.match(/^(\d+),(\d+),(\d+),([\s\S]*)$/)
		if (!match) return

		this.outputCount = Number.parseInt(match[1], 10) || 0
		this.levelCount = Number.parseInt(match[2], 10) || 0
		this.inputCount = Number.parseInt(match[3], 10) || 0

		const names = (match[4] || '')
			.split('~')
			.map((name) => name.trim())
			.filter((name) => name.length > 0)
		this.levelNames = names

		this.updateVariableDefinitions()
		this.updateVariableState()
		this.checkAllFeedbacks()
	}

	parseXStatus(payload) {
		const parts = payload.split(',').map((part) => part.trim())
		if (parts.length < 3) return

		const output = Number.parseInt(parts[0], 10)
		const input = parts[1]
		const level = Number.parseInt(parts[2], 10)

		if (!Number.isFinite(output) || !Number.isFinite(level)) return

		if (level === 0) {
			this.setAfv(output, input)
		} else {
			this.setCrosspoint(output, level, input)
		}
	}

	parseYStatus(payload) {
		const parts = payload.split(',').map((part) => part.trim())
		if (parts.length < 2) return

		const output = Number.parseInt(parts[0], 10)
		const input = parts[1]

		if (!Number.isFinite(output)) return

		this.setAfv(output, input)
	}

	parseVStatus(payload) {
		const parts = payload.split(',').map((part) => part.trim())
		if (parts.length < 2) return

		const output = Number.parseInt(parts[0], 10)
		if (!Number.isFinite(output)) return

		const levelValues = parts.slice(1)
		for (let i = 0; i < levelValues.length; i++) {
			const level = i + 1
			const input = levelValues[i]

			if (input === '0') continue

			this.setCrosspoint(output, level, input)
		}
	}

	setCrosspoint(output, level, input) {
		if (!this.crosspoints[output]) {
			this.crosspoints[output] = {}
		}

		this.crosspoints[output][level] = input
		this.updateVariableState()
		this.checkAllFeedbacks()
	}

	setAfv(output, input) {
		const levels = this.levelCount || 1
		for (let level = 1; level <= levels; level++) {
			this.setCrosspoint(output, level, input)
		}
	}

	setMultiLevel(output, inputs) {
		for (let i = 0; i < inputs.length; i++) {
			const input = inputs[i]
			if (input === '0') continue

			this.setCrosspoint(output, i + 1, input)
		}
	}

	getCrosspoint(output, level) {
		return this.crosspoints[output]?.[level]
	}

	updateVariableState() {
		const values = {
			router_model: this.modelName,
			router_version: this.versionString,
			router_outputs: this.outputCount ? String(this.outputCount) : '',
			router_inputs: this.inputCount ? String(this.inputCount) : '',
			router_levels: this.levelCount ? String(this.levelCount) : '',
			router_capabilities: this.capabilities,
			router_update_mode: this.updateMode,
			router_level_names: this.levelNames.join(', '),
		}
		for (let i = 0; i < this.levelNames.length; i++) {
			values[`router_level_name_${i + 1}`] = this.levelNames[i]
		}
		for (let output = 1; output <= this.outputCount; output++) {
			for (let level = 1; level <= this.levelCount; level++) {
				values[`output_${output}_level_${level}`] = this.getCrosspoint(output, level)
			}
		}
		this.setVariableValues(values)
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

module.exports = ModuleInstance
module.exports.UpgradeScripts = UpgradeScripts
