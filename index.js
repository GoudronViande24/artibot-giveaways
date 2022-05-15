import { SlashCommandBuilder } from "@discordjs/builders";
import Artibot, { Module, SlashCommand } from "artibot";
import Localizer from "artibot-localizer";
import { GiveawaysManager } from "discord-giveaways";
import * as fs from "fs";
import ms from "ms";
import { CommandInteraction, Permissions } from "discord.js";

import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

/**
 * Giveaway module based on discord-giveaways by androz2091
 * @author GoudronViande24
 * @license MIT
 * @param {Artibot} artibot
 * @returns {Module}
 */
export default ({ config: { lang } }) => {
	localizer.setLocale(lang);

	return new Module({
		id: "giveaways",
		name: "Giveaways",
		version,
		repo: "GoudronViande24/artibot-giveaways",
		langs: [
			"en",
			"fr"
		],
		parts: [
			new SlashCommand({
				id: "giveaways",
				data: new SlashCommandBuilder()
					.setName("giveaway")
					.setDescription(localizer._("Create and manage giveaways."))
					.addSubcommand(subcommand =>
						subcommand
							.setName('create')
							.setDescription(localizer._("Create a giveaway"))
							.addStringOption(option =>
								option
									.setName("prize")
									.setDescription(localizer._("The prize to win in this giveaway."))
									.setRequired(true)
							)
							.addStringOption(option =>
								option
									.setName("duration")
									.setDescription(localizer._("Time before the end of the giveaway. Examples: '5h', '2d'"))
									.setRequired(true)
							)
							.addIntegerOption(option =>
								option
									.setName("winners")
									.setDescription(localizer._("How much people will win the prize"))
									.setRequired(true)
							)
							.addUserOption(option =>
								option
									.setName("host")
									.setDescription(localizer._("User that will host the giveaway (sponsor, donator, etc.). By default, it is you."))
							)
							.addChannelOption(option =>
								option
									.setName("channel")
									.setDescription(localizer._("The channel in which to publish the giveaway."))
							)
					)
					.addSubcommand(subcommand =>
						subcommand
							.setName('create-drop')
							.setDescription('Créer un drop')
							.addStringOption(option =>
								option
									.setName("prize")
									.setDescription(localizer._("The prize to win in this drop."))
									.setRequired(true)
							)
							.addIntegerOption(option =>
								option
									.setName("winners")
									.setDescription(localizer._("How much people will win the prize"))
									.setRequired(true)
							)
							.addUserOption(option =>
								option
									.setName("host")
									.setDescription(localizer._("User that will host the giveaway (sponsor, donator, etc.). By default, it is you."))
							)
							.addChannelOption(option =>
								option
									.setName("channel")
									.setDescription(localizer._("The channel in which to start the drop."))
							)
					)
					.addSubcommand(subcommand =>
						subcommand
							.setName('reroll')
							.setDescription(localizer._("Find new winner(s) for an ended giveaway"))
							.addStringOption(option =>
								option
									.setName("id")
									.setDescription(localizer._("The giveaway's message ID."))
									.setRequired(true)
							)
					)
					.addSubcommand(subcommand =>
						subcommand
							.setName('edit')
							.setDescription(localizer._("Edit a giveaway."))
							.addStringOption(option =>
								option
									.setName("id")
									.setDescription(localizer._("The giveaway's message ID."))
									.setRequired(true)
							)
							.addStringOption(option =>
								option
									.setName("option")
									.setDescription(localizer._("What to edit in the giveaway?"))
									.addChoices(
										{
											name: localizer._("How much people will win the prize"),
											value: "winnerCount"
										},
										{
											name: localizer._("Prize to win"),
											value: "prize"
										},
										{
											name: localizer._("Add time"),
											value: "time"
										}
									)
									.setRequired(true)
							)
							.addStringOption(option =>
								option
									.setName("value")
									.setDescription(localizer._("The value of the option to edit."))
									.setRequired(true)
							)
					)
					.addSubcommand(subcommand =>
						subcommand
							.setName('end')
							.setDescription(localizer._("Ends a giveaway immediately."))
							.addStringOption(option =>
								option
									.setName("id")
									.setDescription(localizer._("The giveaway's message ID."))
									.setRequired(true)
							)
					),
				mainFunction,
				initFunction
			})
		]
	});
}

const localizer = new Localizer({
	filePath: path.join(__dirname, "locales.json")
});

/**
 * Giveaway manager
 * @type {GiveawaysManager}
 */
let manager;

/**
 * Initialize the giveaway system on bot startup
 * @param {Artibot} artibot
 */
async function initFunction({ log, config }) {
	// Verify that the data directory exists
	if (!fs.existsSync(path.resolve(__dirname, "data", "giveaways.json"))) {
		if (!fs.existsSync(path.resolve(__dirname, "data"))) {
			log("Giveaways", localizer._("Creating the directory to store the data"));
			fs.mkdirSync(path.resolve(__dirname, "data"));
		};
	};

	// Karens are gonna ask for this
	manager = new GiveawaysManager(client, {
		storage: "./data/giveaways/giveaways.json",
		default: {
			botsCanWin: false,
			embedColor: config.embedColor,
			embedColorEnd: '#000000',
			reaction: '🎉'
		}
	});

	log("Giveaways", localizer._("Ready."));
}

/**
 * Handle the slash commands
 * @param {CommandInteraction}
 * @param {Artibot} artibot
 */
async function mainFunction(interaction, { config, createEmbed }) {
	const command = interaction.options.getSubcommand();

	// ########################################
	// End subcommand
	// ########################################

	if (command == "end") {
		const messageId = interaction.options.getString("id");
		const giveaway = manager.giveaways.find((g) => g.guildId === interaction.guildId && g.messageId === messageId);

		if (!giveaway) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway not found."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		const isGiveawayOwner = giveaway.hostedBy.slice(0, -1).substring(2) == interaction.member.id;
		const isAdmin = interaction.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR);

		if (!isAdmin && !isGiveawayOwner) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions or be the host of the giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		if (giveaway.ended) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("The giveaway is already ended."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		var embed = await manager.end(messageId).then(() => {
			return createEmbed()
				.setTitle("Giveaways")
				.setDescription(localizer._("The giveaway has been ended successfully."));
		}).catch(() => {
			return createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("An error occured."));
		});
	}

	// ########################################
	// Edit subcommand
	// ########################################

	if (command == "edit") {
		const messageId = interaction.options.getString("id");
		const giveaway = manager.giveaways.find((g) => g.guildId === interaction.guildId && g.messageId === messageId);

		if (!giveaway) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway not found."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		const isGiveawayOwner = giveaway.hostedBy.slice(0, -1).substring(2) == interaction.member.id;
		const isAdmin = interaction.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR);

		if (!isAdmin && !isGiveawayOwner) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions or be the host of the giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		if (giveaway.ended) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("Cannot edit an ended giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		const option = interaction.options.getString("option");
		const value = interaction.options.getString("value");

		if (option == "winnerCount") {
			if (!isNaN(value) && parseInt(value) > 0) {
				var settings = { newWinnerCount: parseInt(value) };
			} else {
				const errorEmbed = createEmbed()
					.setColor("RED")
					.setTitle("Giveaways")
					.setDescription(localizer._("Entered value is invalid."));

				await interaction.reply({
					embeds: [errorEmbed],
					ephemeral: true
				});

				return
			}
		}

		if (option == "prize") var settings = { newPrize: value };

		if (option == "time") {
			/**
			 * Check if duration is valid
			 * @since 2.1.1
			 */
			if (!ms(value)) {
				const errorEmbed = createEmbed()
					.setColor("RED")
					.setTitle("Giveaways")
					.setDescription(localizer.__("`[[0]]` is not a valid duration.", { placeholders: [duration] }));

				await interaction.reply({
					embeds: [errorEmbed],
					ephemeral: true
				});

				return
			}

			var settings = { addTime: ms(value) };
		}

		var embed = await manager.edit(messageId, settings).then(() => {
			return createEmbed()
				.setTitle("Giveaways")
				.setDescription(localizer._("The giveaway has been edited."));
		}).catch(() => {
			return createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("An error occured."));
		});
	}

	// ########################################
	// Reroll subcommand
	// ########################################

	if (command == "reroll") {
		const messageId = interaction.options.getString("id");
		const giveaway = manager.giveaways.find((g) => g.guildId === interaction.guildId && g.messageId === messageId);

		if (!giveaway) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway not found."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		const isGiveawayOwner = giveaway.hostedBy.slice(0, -1).substring(2) == interaction.member.id;
		const isAdmin = interaction.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR);

		if (!isAdmin && !isGiveawayOwner) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions or be the host of the giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		var embed = await manager.reroll(messageId, {
			winnerCount: 1,
			messages: {
				congrat: localizer._("Congratulations, {winners}! 🎉\nYou just won **{this.prize}**!"),
				error: localizer._("No valid entry, impossible to choose a new winner for **{this.prize}**.")
			}
		}).then(() => {
			return createEmbed()
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway has been rerolled."));
		}).catch(() => {
			return createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("An error occured."));
		});
	}

	// ########################################
	// Create subcommand
	// ########################################

	if (command == "create") {
		if (interaction.options.getChannel("channel")) {
			var isSameGuild = interaction.channel.guild.id == interaction.options.getChannel("channel").guild.id;
		} else {
			var isSameGuild = true;
		}

		if (!interaction.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR) && isSameGuild) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		const duration = interaction.options.getString("duration"),
			winnerCount = interaction.options.getInteger('winners'),
			prize = interaction.options.getString('prize');

		if (interaction.options.getChannel("channel")) {
			var channel = interaction.options.getChannel("channel");
			if (channel.type !== "GUILD_TEXT") {
				return interaction.reply({
					content: localizer._("Impossible to create a giveaway in this channel."),
					ephemeral: true
				});
			}
		} else {
			var channel = interaction.channel;
		}

		if (interaction.options.getUser("host")) {
			var hostedBy = interaction.options.getUser("host");
		} else {
			var hostedBy = interaction.member.user;
		}

		/**
		 * Check if duration is valid
		 * @since 2.1.1
		 */
		if (!ms(duration) || ms(duration) < 1) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer.__("`[[0]]` is not a valid duration.", { placeholders: [duration] }));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		/**
		 * Check if there is at least one winner
		 * @since 2.1.1
		 */
		if (!winnerCount || winnerCount < 1) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("You must have at least one winner!"));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		await manager.start(channel, {
			duration: ms(duration),
			winnerCount,
			prize,
			hostedBy,
			messages: {
				giveawayEnded: localizer._("Giveaway ended."),
				inviteToParticipate: localizer._("React with 🎉 to participate!"),
				winMessage: localizer._("🎉 Congratulations, {winners}! 🎉\nYou just won **{this.prize}**!"),
				drawing: localizer._("Draw ({this.winnerCount} winner(s)): {timestamp}."),
				embedFooter: {
					text: config.botName,
					iconURL: config.botIcon
				},
				noWinner: localizer._("Giveaway canceled, no valid entry."),
				winners: localizer._("Winner(s):"),
				endedAt: localizer._("Ended on"),
				hostedBy: localizer._("Hosted by {this.hostedBy}")
			}
		});

		var embed = createEmbed()
			.setTitle("Giveaways")
			.setDescription(localizer._("The giveaway has been created!"));
	}

	// ########################################
	// Create drop subcommand
	// ########################################

	if (command == "create-drop") {
		if (interaction.options.getChannel("channel")) {
			var isSameGuild = interaction.channel.guild.id == interaction.options.getChannel("channel").guild.id;
		} else {
			var isSameGuild = true;
		}

		if (!interaction.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR) && isSameGuild) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		const winnerCount = interaction.options.getInteger("winners"),
			prize = interaction.options.getString("prize");

		if (interaction.options.getChannel("channel")) {
			var channel = interaction.options.getChannel("channel");
			if (channel.type !== "GUILD_TEXT") {
				return interaction.reply({
					content: localizer._("Impossible to create a giveaway in this channel."),
					ephemeral: true
				});
			}
		} else {
			var channel = interaction.channel;
		}

		if (interaction.options.getUser("host")) {
			var hostedBy = interaction.options.getUser("host");
		} else {
			var hostedBy = interaction.member.user;
		}

		/**
		 * Check if there is at least one winner
		 * @since 2.1.1
		 */
		if (!winnerCount || winnerCount < 1) {
			const errorEmbed = createEmbed()
				.setColor("RED")
				.setTitle("Giveaways")
				.setDescription(localizer._("You must have at least one winner!"));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return
		}

		await manager.start(channel, {
			duration: ms("1d"),
			winnerCount,
			prize,
			hostedBy,
			messages: {
				dropMessage: localizer._("Be the first to react with 🎉 to win!\n{this.winnerCount} winner(s)"),
				giveawayEnded: localizer._("Drop ended."),
				winMessage: localizer._("🎉 Congratulations, {winners}! 🎉\nYou just won **{this.prize}**!"),
				embedFooter: {
					text: config.botName,
					iconURL: config.botIcon
				},
				noWinner: localizer._("Drop canceled, no valid entry."),
				winners: localizer._("Winner(s):"),
				endedAt: localizer._("Ended on"),
				hostedBy: localizer._("Hosted by {this.hostedBy}")
			},
			isDrop: true
		});

		var embed = createEmbed()
			.setTitle("Giveaways")
			.setDescription(localizer._("The drop has been started!"));
	}

	await interaction.reply({
		embeds: [embed],
		ephemeral: true
	});
}