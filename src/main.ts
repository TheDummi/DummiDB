import { resolve } from "path";
import * as fs from "node:fs";

interface Settings {
	directory: string;
}

export default class DatabaseHandler {
	settings: Settings;
	[index: string]: any;

	constructor(settings: Settings) {
		this.settings = settings;

		settings.directory = resolve(settings.directory);

		try {
			fs.readdirSync(settings.directory);
		} catch (error: any) {
			if (error.code === "ENOENT") {
				fs.mkdir(settings.directory, (err: any) => {
					if (err) throw new Error(err);
				});
			} else throw new Error(error);
		}

		this.#syncRows();

		return this;
	}

	create(name: string, data: any) {
		if (this[name]) {
			data.createdAt = new Date();
			data.createdTimestamp = Date.now();
			data.updatedAt = new Date();
			data.updatedTimestamp = Date.now();

			for (const [k, v] of Object.entries(data)) {
				if (typeof v === "object") {
					if ((v as { unique: boolean }).unique) {
						for (const e of this[name]) {
							if ((v as { value: string | number }).value === e[k].value) {
								throw new Error(
									`Unique value constraint. ${k} already exists with value ${
										(v as { value: number | string }).value
									}.`
								);
							}
						}
					}

					if ((v as { type: string }).type) {
						if (
							(v as { type: string }).type !==
							typeof (v as { value: string | number }).value
						)
							throw new Error(
								`Type constraint expected ${
									(v as { type: string }).type
								}, received ${typeof (v as { value: string | number })
									.value} instead.`
							);
					}
				}
			}

			this[name].push(data);

			fs.writeFileSync(
				`${this.settings.directory}/${name}.json`,
				JSON.stringify(this[name])
			);

			return { data: data, created: true };
		} else {
			this.addRow(name);

			return { data: [], created: true };
		}
	}

	delete(name: string, query: any) {
		const response = [];

		for (const data of this[name]) {
			const checks = [];

			for (let [k, v] of Object.entries(query)) {
				if (typeof v === "object") v = (v as Record<"value", string>).value;
				if (typeof data[k] === "object")
					data[k] = (data[k] as Record<"value", string>).value;
				checks.push(v === data[k]);
			}

			if (!checks.includes(false)) {
				response.push(this[name].splice(this[name].indexOf(data), 1));
			}
		}

		fs.writeFileSync(
			`${this.settings.directory}/${name}.json`,
			JSON.stringify(this[name])
		);

		this.#syncRows();

		return response;
	}

	addRow(name: string) {
		let response = {};

		try {
			const data = fs.readFileSync(
				`${this.settings.directory}/${name}.json`,
				"utf-8"
			);

			response = { [name]: JSON.parse(data), created: false };
		} catch (error: any) {
			if (error.code === "ENOENT") {
				fs.writeFileSync(`${this.settings.directory}/${name}.json`, "[]");
				response = { [name]: [], created: true };
			} else throw new Error(error);
		}

		this.#syncRows();

		return response;
	}

	#syncRows() {
		const rows = fs.readdirSync(this.settings.directory);

		for (const row of rows) {
			const data = fs.readFileSync(
				`${this.settings.directory}/${row}`,
				"utf-8"
			);

			this[row.replace(".json", "")] = JSON.parse(data);
		}
	}
}
