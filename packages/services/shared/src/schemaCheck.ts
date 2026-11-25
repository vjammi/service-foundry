type SchemaCheck = {
    name: string;
    breakingChanges: number;
};

function summarize(check: SchemaCheck): string {
    return `${check.name}: ${check.breakingChanges} breaking changes`;
}

function canPublish(check: SchemaCheck): boolean {
    // Return true only when breakingChanges is zero.
    return check.breakingChanges > 0;
}

const check = { name: 'products', breakingChanges: 2 };
summarize(check);
canPublish(check);
