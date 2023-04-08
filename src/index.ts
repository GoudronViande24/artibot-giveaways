import Artibot, { Module, SlashCommand, log } from "artibot";
import Localizer from "artibot-localizer";
import { Giveaway, GiveawayEditOptions, GiveawaysManager } from "discord-giveaways";
import * as fs from "fs";
import ms from "ms";
import { ChatInputCommandInteraction, SlashCommandBuilder, GatewayIntentBits, PermissionsBitField, EmbedBuilder, GuildTextBasedChannel, User } from "discord.js";

import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

/**
 * Giveaway module based on discord-giveaways by androz2091
 * @author GoudronViande24
 * @license MIT
 */
export default ({ config: { lang } }: Artibot): Module => {
	localizer.setLocale(lang);

	return new Module({
		id: "giveaways",
		name: "Giveaways",
		version,
		repo: "GoudronViande24/artibot-giveaways",
		packageName: "artibot-giveaways",
		langs: [
			"en",
			"fr"
		],
		intents: [
			GatewayIntentBits.GuildMessageReactions
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
									.setMinValue(1)
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
									.setMinValue(1)
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

const localizer: Localizer = new Localizer({
	filePath: path.join(__dirname, "../locales.json")
});

/** Giveaway manager */
let manager: GiveawaysManager;

/** Initialize the giveaway system on bot startup */
async function initFunction({ config, client }: Artibot): Promise<void> {
	// Verify that the data directory exists
	if (!fs.existsSync("./data/giveaways/giveaways.json")) {
		if (!fs.existsSync("./data/giveaways")) {
			log("Giveaways", localizer._("Creating the directory to store the data"));
			fs.mkdirSync("./data/giveaways", { recursive: true });
		};
	};

	// Karens are gonna ask for this
	manager = new GiveawaysManager(client!, {
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

/** Handle the slash commands */
async function mainFunction(interaction: ChatInputCommandInteraction<"cached">, { config, createEmbed }: Artibot): Promise<void> {
	const command: string = interaction.options.getSubcommand(true);
	const embed: EmbedBuilder = createEmbed().setTitle("Giveaways");

	// ########################################
	// End subcommand
	// ########################################

	if (command == "end") {
		const messageId: string = interaction.options.getString("id", true);
		const giveaway: Giveaway | undefined = manager.giveaways.find((g) => g.guildId === interaction.guildId && g.messageId === messageId);

		if (!giveaway) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway not found."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		if (!hasPerms(giveaway, interaction)) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions or be the host of the giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		if (giveaway.ended) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("The giveaway is already ended."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		try {
			await manager.end(messageId);
			embed.setDescription(localizer._("The giveaway has been ended successfully."));
		} catch (e) {
			embed
				.setColor("Red")
				.setDescription(localizer._("An error occured."));
		}
	}

	// ########################################
	// Edit subcommand
	// ########################################

	if (command == "edit") {
		const messageId: string = interaction.options.getString("id", true);
		const giveaway: Giveaway | undefined = manager.giveaways.find((g) => g.guildId === interaction.guildId && g.messageId === messageId);

		if (!giveaway) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway not found."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		if (!hasPerms(giveaway, interaction)) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions or be the host of the giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		if (giveaway.ended) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("Cannot edit an ended giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		const option: string = interaction.options.getString("option", true);
		const value: string = interaction.options.getString("value", true);

		const settings: GiveawayEditOptions<any> = {};

		switch (option) {
			case "winnerCount":
				if (!isNaN(parseInt(value)) && parseInt(value) > 0) {
					settings.newWinnerCount = parseInt(value);
				} else {
					const errorEmbed: EmbedBuilder = createEmbed()
						.setColor("Red")
						.setTitle("Giveaways")
						.setDescription(localizer._("Entered value is invalid."));
					await interaction.reply({
						embeds: [errorEmbed],
						ephemeral: true
					});
					return;
				}
				break;

			case "prize":
				settings.newPrize = value;
				break;

			case "time":
				/**
				 * Check if duration is valid
				 * @since 2.1.1
				 */
				if (!ms(value)) {
					const errorEmbed = createEmbed()
						.setColor("Red")
						.setTitle("Giveaways")
						.setDescription(localizer.__("`[[0]]` is not a valid duration.", { placeholders: [value] }));
					await interaction.reply({
						embeds: [errorEmbed],
						ephemeral: true
					});
					return;
				}
				settings.addTime = ms(value);
				break;
		}

		try {
			await manager.edit(messageId, settings);
			embed.setDescription(localizer._("The giveaway has been edited."));
		} catch (e) {
			embed
				.setColor("Red")
				.setDescription(localizer._("An error occured."));
		}
	}

	// ########################################
	// Reroll subcommand
	// ########################################

	if (command == "reroll") {
		const messageId: string = interaction.options.getString("id", true);
		const giveaway: Giveaway | undefined = manager.giveaways.find((g) => g.guildId === interaction.guildId && g.messageId === messageId);

		if (!giveaway) {
			const errorEmbed = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("Giveaway not found."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		if (!hasPerms(giveaway, interaction)) {
			const errorEmbed = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions or be the host of the giveaway."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		try {
			await manager.reroll(messageId, {
				winnerCount: 1,
				messages: {
					congrat: localizer._("Congratulations, {winners}! 🎉\nYou just won **{this.prize}**!"),
					error: localizer._("No valid entry, impossible to choose a new winner for **{this.prize}**.")
				}
			});
			embed.setDescription(localizer._("Giveaway has been rerolled."));
		} catch (e) {
			embed
				.setColor("Red")
				.setDescription(localizer._("An error occured."));
		}
	}

	// ########################################
	// Create subcommand
	// ########################################

	if (command == "create") {
		let isSameGuild: boolean;

		if (interaction.options.getChannel("channel")) {
			isSameGuild = interaction.channel!.guild.id == interaction.options.getChannel("channel")!.guild.id;
		} else {
			isSameGuild = true;
		}

		if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && isSameGuild) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		const duration: string = interaction.options.getString("duration", true);
		const winnerCount: number = interaction.options.getInteger('winners', true);
		const prize: string = interaction.options.getString('prize', true);
		const channel: GuildTextBasedChannel = interaction.options.getChannel("channel") || interaction.channel!;
		const hostedBy: User = interaction.options.getUser("host") || interaction.member.user;

		/**
		 * Check if duration is valid
		 * @since 2.1.1
		 */
		if (!ms(duration) || ms(duration) < 1) {
			const errorEmbed = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer.__("`[[0]]` is not a valid duration.", { placeholders: [duration] }));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
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

		embed.setDescription(localizer._("The giveaway has been created!"));
	}

	// ########################################
	// Create drop subcommand
	// ########################################

	if (command == "create-drop") {
		let isSameGuild: boolean;
		if (interaction.options.getChannel("channel")) {
			isSameGuild = interaction.channel!.guild.id == interaction.options.getChannel("channel")!.guild.id;
		} else {
			isSameGuild = true;
		}

		if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && isSameGuild) {
			const errorEmbed: EmbedBuilder = createEmbed()
				.setColor("Red")
				.setTitle("Giveaways")
				.setDescription(localizer._("**You cannot execute this command.**\nYou must have the administrator permissions."));

			await interaction.reply({
				embeds: [errorEmbed],
				ephemeral: true
			});

			return;
		}

		const winnerCount: number = interaction.options.getInteger("winners", true);
		const prize: string = interaction.options.getString("prize", true);
		const channel: GuildTextBasedChannel = interaction.options.getChannel("channel") || interaction.channel!;
		const hostedBy: User = interaction.options.getUser("host") || interaction.member.user;

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

		embed.setDescription(localizer._("The drop has been started!"));
	}

	await interaction.reply({
		embeds: [embed],
		ephemeral: true
	});
}

function hasPerms(giveaway: Giveaway, interaction: ChatInputCommandInteraction<"cached">): boolean {
	const isGiveawayOwner: boolean = giveaway.hostedBy!.id == interaction.member.id;
	const isAdmin: boolean = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

	return isGiveawayOwner || isAdmin;
}