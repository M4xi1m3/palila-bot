const Discord = require('discord.js');
const fs = require('fs');
const { execSync } = require('child_process');
const worker = require('worker_threads');
const { download } = require('../services/http');
const path = require("path")

const config = require('../config/config.json');

let ytb_vids = true;
let twitter_vids = true;
let discord_link = true;

async function downloadChan(message) {

	// return message.channel.send("Cette fonctionnalité est pour l'instant désactivée.").catch(e => err("Impossible d'envoyer un message sur ce channel.", message, e));

	message.channel.send(`Lancement de la backup du channel en cours... Merci de ne plus envoyer de messages ici avant la fin du scan du channel :eyes:`).catch(e => err("Impossible d'envoyer un message sur ce channel.", message, e));
	log(`Lancement de la backup par ${message.author.tag}`, message);

	//on déclare les tableaux qui vont contenir tout les messages analysés
	let tout = [];
	let msg_img = [];
	let youtube_url = [];
	let twitter_url = [];
	let last_id;

	try {
		while (true) {
			//on récupère tout les messages du channel
			let options = { limit: 100 };
			if (last_id)
				options.before = last_id;

			let messages = await message.channel.messages.fetch(options);

			//on les met tous dans le tableau tout
			messages.forEach(msg => {
				tout.push(msg);
			});

			last_id = messages.array()[messages.array().length - 1].id;

			if (messages.array().length != 100)
				break;

		}
	}
	catch (error) {
		err("Impossible de télécharger tout les messages.", null, error)
		return;
	}

	tout.forEach(msg => {

		// images et vidéos discord
		if (msg.attachments.array().length > 0 && discord_link) {
			msg_img.push(msg.attachments);
		}


		// vidéos youtubes
		if (msg.content.includes(`https://www.youtube.com/watch`) && ytb_vids) {
			let items = msg.content.split(' ');

			for (let item of items) {
				if (item.startsWith(`https://www.youtube.com/watch`)) {
					youtube_url.push(item);
				}
			}

		}

		if (msg.content.includes(`https://youtu.be/`) && ytb_vids) {
			let items = msg.content.split(' ');

			for (let item of items) {
				if (item.startsWith(`https://youtu.be/`)) {
					youtube_url.push(item);
				}
			}
		}


		//vidéos twitter
		if (msg.content.includes(`https://twitter.com/`) && twitter_vids) {
			let items = msg.content.split(' ');

			for (let item of items) {
				if (item.startsWith(`https://twitter.com/`)) {
					twitter_url.push(item);
				}
			}
		}

		if (msg.content.includes(`https://t.co`) && twitter_vids) {
			let items = msg.content.split(' ');

			for (let item of items) {
				if (item.startsWith(`https://t.co`)) {
					twitter_url.push(item);
				}
			}
		}
	});

	log(`Fin du scan`, message);
	log(`Messages trouvées : ${tout.length}`, message);
	log(`Messages avec attachements trouvés : ${msg_img.length}`, message);
	log(`Vidéos YouTube trouvées : ${youtube_url.length}`, message);
	log(`Vidéos Twitter trouvées : ${twitter_url.length}`, message);

	const embed = new Discord.MessageEmbed()
		.setTitle("Fin du scan")
		.setColor(0x1e80d6)
		.setDescription(
			`Messages trouvées : ${tout.length}
		Messages avec attachements trouvés : ${msg_img.length}
		Vidéos YouTube trouvées : ${youtube_url.length}
		Vidéos Twitter trouvées : ${twitter_url.length}`);

	try {
		await message.channel.send(embed);
	}
	catch (e) {
		err("Impossible d'envoyer un message sur ce channel.", message, e);
	}

	// on créé le dossier dans lequel on va mettre la backup
	let today = new Date();
	let folderName = `Backup_${message.guild.name}_${message.channel.name}_${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}`;
	folderName = folderName.replaceAll('/', '_')
		.replaceAll('\\', '_')
		.replaceAll(' ', '_');

	log(`Création du dossier ${folderName}...`, message);


	try {
		let dir = `./guilds/${message.guild.id}/${folderName}`;
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
			log(`Dossier créé.`, message);
		}
		else {
			log(`Le dossier existe déjà.`, message)
		}
	}
	catch (error) {
		err("Impossible de créer le dossier.", message, error)
	}

	try {
		await message.channel.send("Début du téléchargement");
	}
	catch (e) {
		err("Impossible d'envoyer un message sur ce channel.", message, e);
	}

	log(`Début du telechargement`, message);
	let compt = 1;

	//on dl chaque image/video
	for (let att of msg_img) {

		for (let bidule of att) {
			let img = bidule[1];

			// si le fichier existe deja, on adapte le nom
			if (fs.existsSync(`./guilds/${message.guild.id}/${folderName}/${img.name}`)) {
				let nbFiles = fs.readdirSync(`./guilds/${message.guild.id}/${folderName}`).filter(file => file.startsWith(img.name.split(".")[0])).length;
				img.name = img.name.split(".")[0].concat(`-${nbFiles}.`).concat(img.name.split(".")[1]);
			}

			try {
				await download(img.url, `${__dirname}/../guilds/${message.guild.id}/${folderName}/${img.name}`);
			}
			catch (error) {
				err("Impossible de télécharger cette image", message, error);
			}

		}

		compt++;

	}

	log(`Backup des images et des videos terminé`, message);

	log(`Début du téléchargement des vidéos YouTube`, message);
	compt = 1;

	//on dl chaque vidéo youtube
	for (let videoURL of youtube_url) {

		try {
			youtubeDownload(videoURL, `${__dirname}/../guilds/${message.guild.id}/${folderName}`);
		}
		catch (error) {
			err("Impossible de télécharger cette vidéo YouTube.", message, error);
		}


		compt++;
	}

	log(`Vidéos YouTube téléchargés`, message);


	log(`Début du téléchargement des vidéos Twitter`, message);

	compt = 1;

	for (let videoURL of twitter_url) {
		let videoName = "video_twitter.mp4";

		if (fs.existsSync(`./guilds/${message.guild.id}/${folderName}/${videoName}`)) {
			let nbFiles = fs.readdirSync(`./guilds/${message.guild.id}/${folderName}`).filter(file => file.startsWith(videoName.split(".")[0])).length;
			videoName = videoName.split(".")[0].concat(`-${nbFiles}.`).concat(videoName.split(".")[1]);
		}

		try {
			twitterDownload(videoURL, `${__dirname}/../guilds/${message.guild.id}/${folderName}/${videoName}`);
		}
		catch (error) {
			err("Impossible de télécharger cette vidéo Twitter.", message, error)
		}

		compt++;
	}

	log(`Vidéos Twitter téléchargés`, message);
	log(`Backup terminée`, message);

	await message.channel.send("Backup terminée ! Demandez à Kayn#2222 pour qu'il vous passe l'archive !").catch(e => err("Impossible d'envoyer un message sur ce channel.", message, e));

}

function twitterDownload(url, dest) {
	execSync(path.join(
		__dirname,
		"..",
		"bin",
		process.platform,
		process.platform === "win32" ? "youtube-dl.exe" : "youtube-dl"
	) + ` --no-warnings -q -o "${dest}" ${url}`)
}

function youtubeDownload(url, dest) {
	execSync(path.join(
		__dirname,
		"..",
		"bin",
		process.platform,
		process.platform === "win32" ? "youtube-dl.exe" : "youtube-dl"
	) + ` --no-warnings -q -o "${dest}/%(title)s.%(ext)s" ${url}`)
}

if (worker.isMainThread) {
	err("ce script ne peut fonctionner indépendamment");
	return;
}
else {
	log("Execution du nouveau thread");

	let param = worker.receiveMessageOnPort(worker.parentPort).message;

	const client = new Discord.Client();


	client.on('ready', async () => {
		log("Nouveau client connecté");

		const chan = await client.channels.fetch(param.channelID);

		const message = await chan.messages.fetch(param.msgID);

		if (message === undefined)
			err('message est vide');
		else {

			ytb_vids = !param.arguments.includes("no-ytb-link");
			twitter_vids = !param.arguments.includes("no-twitter-link");
			discord_link = !param.arguments.includes("no-attachement");

			await downloadChan(message);

			client.destroy();
		}


	})

	client.login(config.discord.token);
}

function log(text, msg) {
	require('../utils').logStdout(text, "downloader", msg ?? null);
}

function err(text, msg, e) {
	require('../utils').logError(text, "downloader", msg ?? null, e ? e.stack : null)
}