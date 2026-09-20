import type { Role } from "@/types/types";

export type RoleExpression = "neutral" | "skeptical" | "pleased" | "stern";

function slug(value: string) {
	return value.toLowerCase().replace(/\s+/g, "-");
}

export function backgroundArtPath(role: Role) {
	const folder = slug(role.location);
	return `/assets/${folder}/${folder}-background-16x9-1920x1080.png`;
}

export function roleArtPath(role: Role, expression: RoleExpression) {
	const folder = slug(role.location);
	const occupation = slug(role.occupation);
	const dimensions = role.occupation === "Guard Soldier"
		? "16x9-1664x936"
		: role.occupation === "Landlord" && expression !== "neutral"
			? "original-1672x941"
			: "16x9-1920x1080";

	return `/assets/${folder}/${occupation}-${expression}-${dimensions}.png`;
}
