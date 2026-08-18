import "./index.css";
import countries from "../metadata/w2_locations_by_country.json";
import stations_csv from "../metadata/w3_location2station.csv";
import panzoom from "panzoom";

const figures: { [_: string]: () => Promise<{ default: string }> } =
	import.meta.glob("*", { base: "../figures/" });

const stations: Map<string, Station> = parse_stations(stations_csv);

function main(): void {
	const { goto } = set_up_charts(
		document.getElementById("charts") as HTMLFormElement,
	);
	set_up_map(document.getElementById("map-container") as HTMLElement, goto);
}

async function set_up_map(
	map_container: HTMLElement,
	click: (id: string) => void,
): Promise<void> {
	const map_img = map_container.querySelector("img") as HTMLImageElement;
	const infopanel = map_container.querySelector(".infopanel")!;

	// TODO: Handle window resizing
	const w = map_img.clientWidth;
	const h = (map_img.naturalHeight / map_img.naturalWidth) * w;
	const pan_zoom = panzoom(map_img, {
		minZoom: 1,
		maxZoom: 10,
		bounds: true,
		initialX: w / 2,
		initialY: h / 2,
		boundsPadding: 1,
		initialZoom: 1,
	});
	for (const [station_id, station] of stations) {
		const x = ((180 + station.lon) / 360) * w;
		const y = ((90 - station.lat) / 180) * h;

		const a = document.createElement("a");
		a.href = "#charts";
		a.innerHTML =
			"<svg viewBox='-4 -4 18 18'><path d='M0,1 1,0 10,9 9,10ZM9,0 10,1 1,10 0,9Z'/><path d='M0,1 1,0 10,9 9,10ZM9,0 10,1 1,10 0,9Z'/></svg>";

		map_container.append(a);

		a.addEventListener("mouseover", () => {
			infopanel.textContent = format_station_name(station.name);
		});
		a.addEventListener("click", () => click(station_id));

		const update = () => {
			const t = pan_zoom.getTransform();
			a.style.left = `${t.x + x * t.scale}px`;
			a.style.top = `${t.y + y * t.scale}px`;
		};
		pan_zoom.on("transform", () => update());
		update();
	}
}

function set_up_charts(charts: HTMLFormElement): {
	goto: (id: string) => void;
} {
	const display_div = charts.querySelector(".display")!;
	const img_container = display_div.querySelector(".img-container")!;
	charts
		.querySelectorAll(".radiolist")
		.forEach((e) => animate_radiolist(e as HTMLElement));

	const default_graph = "GM000003342";

	const goto_functions = new Map();

	{
		const nav = charts.querySelector(".nav")!;
		const ul = document.createElement("ul");
		for (const [country, country_stations] of Object.entries(countries)) {
			if (country_stations.length === 0) {
				continue;
			}
			const li = document.createElement("li");
			const details = document.createElement("details");
			const summary = document.createElement("summary");
			summary.append(country);
			const station_ul = document.createElement("ul");
			station_ul.classList.add("radiolist");
			// TODO: Sort these alphabetically
			for (const station_id of country_stations) {
				const station = stations.get(station_id);
				if (station === undefined) {
					console.error(`could not find info for station ${station_id}`);
					continue;
				}

				const station_li = document.createElement("li");
				const label = document.createElement("label");
				const input = document.createElement("input");
				input.type = "radio";
				input.name = "station";
				input.value = station_id;
				if (station_id === default_graph) {
					input.checked = true;
					details.open = true;
				}
				label.append(input, format_station_name(station.name));
				station_li.append(label);
				station_ul.append(station_li);

				goto_functions.set(station_id, () => {
					if (!details.open) {
						summary.dispatchEvent(new Event("click"));
					}
					input.checked = true;
					charts.dispatchEvent(new Event("input"));
				});
			}
			details.append(summary, station_ul);
			animate_radiolist(station_ul);
			animate_details(details, station_ul);
			li.append(details);
			ul.append(li);
		}
		nav.append(ul);
	}

	const station_input = charts.elements.namedItem(
		"station",
	) as HTMLInputElement;
	const type_input = charts.elements.namedItem("type") as RadioNodeList;
	const fig_input = charts.elements.namedItem("fig") as RadioNodeList;
	const fig_fieldset = charts.querySelector("fieldset.fig") as HTMLElement;

	const update = async () => {
		const station = station_input.value;
		if (station === "") return;
		const type = type_input.value;
		const fig = fig_input.value;
		const img = new Image();

		const disable_fig = type === "a";
		for (const input of fig_input) {
			input.disabled = disable_fig;
		}
		fig_fieldset.classList.toggle("disabled", disable_fig);

		img.src = (
			await figures[
				type === "a"
					? `./${station}_fig1.webp`
					: `./${station}_type${type}_fig${fig}.webp`
			]()
		).default;
		await img.decode();
		img_container.replaceChildren(img);
	};

	charts.addEventListener("input", () => update());
	update();

	return {
		goto: (id) => goto_functions.get(id)(),
	};
}

type Station = {
	name: string;
	lat: number;
	lon: number;
	elevation: number;
};

function parse_stations(csv: string): Map<string, Station> {
	const map = new Map();
	const station_line_regex =
		/^\d+,([A-Z0-9]{11}),"([A-Z0-9, ]+)",([0-9.-]+),([0-9.-]+),([0-9.-]+)$/;

	for (const [i, line] of csv.split("\n").entries()) {
		if (i === 0 || line === "") continue;
		const matched = station_line_regex.exec(line);
		if (matched === null) {
			console.error(`failed to match on line ${i + 1}: ${line}`);
			continue;
		}
		const [_, id, name, lat, lon, elevation] = matched;
		map.set(id, {
			name,
			lat: parseFloat(lat),
			lon: parseFloat(lon),
			elevation: parseFloat(elevation),
		});
	}
	return map;
}

function format_station_name(name: string): string {
	// Remove country; it is displayed already in UI
	name = name.slice(0, name.lastIndexOf(","));
	return name.replace(/\w\S*/g, (s) => s.charAt(0) + s.slice(1).toLowerCase());
}

// https://css-tricks.com/how-to-animate-the-details-element/
function animate_details(el: HTMLDetailsElement, content: HTMLElement): void {
	const summary = el.querySelector("summary")!;

	if (el.open) {
		el.classList.add("open");
	}

	let animation: null | Animation = null;
	let animating_to: null | boolean = null;

	summary.addEventListener("click", async (e) => {
		e.preventDefault();
		el.style.overflow = "hidden";

		if (animating_to === false || !el.open) {
			el.style.height = `${el.offsetHeight}px`;
			el.open = true;
			await new Promise((r) => requestAnimationFrame(r));
			animating_to = true;
			el.classList.add("open");
		} else if (animating_to === true || el.open) {
			animating_to = false;
			el.classList.remove("open");
		}

		if (animating_to === null) return;

		const startHeight = `${el.offsetHeight}px`;
		const endHeight = `${summary.offsetHeight + (animating_to ? content.offsetHeight : 0)}px`;

		if (animation) animation.cancel();

		animation = el.animate(
			{ height: [startHeight, endHeight] },
			{ duration: 150, easing: "ease-out" },
		);
		animation.onfinish = () => {
			el.open = animating_to!;
			animation = null;
			animating_to = null;
			el.style.height = el.style.overflow = "";
		};
	});
}

function animate_radiolist(el: HTMLElement): void {
	for (const li of el.querySelectorAll("li")) {
		const label = li.querySelector("& > label")!;
		label.addEventListener("click", (e) => {
			if (label !== e.target) return;
			const prev = el.querySelector("li:has(input:checked)");
			if (prev === null) return;

			const li_rect = li.getBoundingClientRect();
			const prev_rect = prev.getBoundingClientRect();
			const x =
				prev_rect.x + prev_rect.width / 2 - (li_rect.x + li_rect.width / 2);
			const y =
				prev_rect.y + prev_rect.height / 2 - (li_rect.y + li_rect.height / 2);
			const w = prev_rect.width / li_rect.width;
			const h = prev_rect.height / li_rect.height;
			li.style.setProperty("--l", `${x}px`);
			li.style.setProperty("--t", `${y}px`);
			li.style.setProperty("--w", `${w}`);
			li.style.setProperty("--h", `${h}`);
			li.classList.add("in");
			prev.classList.add("out");

			requestAnimationFrame(() => {
				li.classList.remove("in");
				prev.classList.remove("out");
			});
		});
	}
}

main();
