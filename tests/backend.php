<?php
// Run in the Panel PHP runtime. All fixture data lives in in-memory SQLite.
declare(strict_types=1);
require '/app/vendor/autoload.php';
$app = require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$app['config']->set('database.connections.regiondisplay_test', [
    'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
]);
Illuminate\Support\Facades\DB::setDefaultConnection('regiondisplay_test');

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Pterodactyl\Models\User;

require __DIR__ . '/../src/Http/RegionController.php';
foreach (['users', 'locations', 'nodes', 'servers', 'subusers'] as $table) {
    Schema::create($table, function (Blueprint $t) use ($table): void {
        $t->increments('id');
        if ($table === 'locations') $t->string('short');
        if ($table === 'nodes') $t->unsignedInteger('location_id');
        if ($table === 'servers') {
            $t->unsignedInteger('owner_id'); $t->unsignedInteger('node_id'); $t->string('uuid');
        }
        if ($table === 'subusers') { $t->unsignedInteger('server_id'); $t->unsignedInteger('user_id'); }
    });
}
$migration = require __DIR__ . '/../database/migrations/2026_10_08_000000_create_regiondisplay_locations.php';
$migration->up();
DB::table('users')->insert([['id' => 1], ['id' => 2], ['id' => 3]]);
DB::table('locations')->insert([['id' => 1, 'short' => 'east'], ['id' => 2, 'short' => 'tokyo'], ['id' => 3, 'short' => 'unused']]);
DB::table('nodes')->insert([['id' => 1, 'location_id' => 1], ['id' => 2, 'location_id' => 2]]);
$uuid = fn (int $id): string => sprintf('12345678-1234-4234-8234-%012d', $id);
foreach ([1, 2, 3] as $id) DB::table('servers')->insert(['id' => $id, 'owner_id' => $id === 3 ? 2 : 1, 'node_id' => 1, 'uuid' => $uuid($id)]);
$controller = new RegionDisplay\Http\RegionController();
function req(int $id, array $data = []): Request {
    $user = new User(); $user->id = $id; $user->root_admin = $id === 3;
    $request = Request::create('/', 'POST', $data);
    app()->instance('request', $request);
    $request->setUserResolver(fn () => $user);
    return $request;
}
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
    echo "PASS: $message\n";
}
function denied(callable $action, string $message, int $status): void {
    try { $action(); }
    catch (Illuminate\Validation\ValidationException $e) { check($status === 422, $message); return; }
    catch (Illuminate\Database\Eloquent\ModelNotFoundException $e) { check($status === 404, $message); return; }
    catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { check($e->getStatusCode() === $status, $message); return; }
    throw new RuntimeException($message);
}
$save = fn (array $data, string $location = '1') => $controller->update(req(3, $data), $location)->getData(true)['region'];
$lookup = fn (int $user, array $ids) => $controller->servers(req($user, ['uuids' => $ids]))->getData(true)['regions'];
check($controller->show(req(3), '1')->getData(true)['region'] === null, 'Unassigned location returns no region');
denied(fn () => $controller->show(req(1), '1'), 'Location reads require administrator access', 403);
denied(fn () => $controller->update(req(1, ['country_code' => 'US', 'display_name' => null]), '1'), 'Server owners cannot assign location regions', 403);
denied(fn () => $controller->delete(req(1), '1'), 'Server owners cannot clear location regions', 403);
denied(fn () => $controller->show(req(3), '999'), 'Missing location is rejected', 404);
$region = $save(['country_code' => 'US', 'display_name' => ' US East ']);
check($region['name'] === 'US East' && $region['country_code'] === 'US', 'Custom display names are normalized');
check($lookup(1, [$uuid(1), $uuid(2)])[$uuid(2)]['name'] === 'US East', 'Servers inherit one shared location assignment');
check($lookup(1, [$uuid(3), $uuid(99)]) === [$uuid(3) => null, $uuid(99) => null], 'Inaccessible and nonexistent servers do not disclose regions');
check($lookup(3, [$uuid(3)])[$uuid(3)]['name'] === 'US East', 'Root administrators can read all server regions');
DB::table('subusers')->insert(['user_id' => 1, 'server_id' => 3]);
check($lookup(1, [$uuid(3)])[$uuid(3)]['name'] === 'US East', 'Subusers can see their accessible server region');
DB::table('subusers')->delete();
check($lookup(1, [$uuid(3)])[$uuid(3)] === null, 'Revoked subuser access hides the region on the next request');
$japan = $save(['country_code' => 'JP', 'display_name' => ' '], '2');
check($japan['name'] === 'Japan' && $japan['display_name'] === null, 'Blank custom names use the country name');
DB::table('servers')->where('id', 1)->update(['node_id' => 2]);
check($lookup(1, [$uuid(1)])[$uuid(1)]['name'] === 'Japan', 'Completed transfer follows the new node location');
DB::table('nodes')->where('id', 2)->update(['location_id' => 3]);
check($lookup(1, [$uuid(1)])[$uuid(1)] === null, 'Moving a node to an unassigned location hides its server region');
DB::table('nodes')->where('id', 2)->update(['location_id' => 2]);
$save(['country_code' => 'CA', 'display_name' => '0']);
check($lookup(1, [$uuid(2)])[$uuid(2)]['name'] === '0' && DB::table('ext_regiondisplay_locations')->count() === 2, 'Updating an assignment preserves a valid zero label and creates no duplicates');
foreach (['ZZ', 'us', '<script>'] as $invalid) denied(fn () => $save(['country_code' => $invalid, 'display_name' => null]), 'Invalid country code rejected: ' . $invalid, 422);
denied(fn () => $save(['country_code' => 'US', 'display_name' => str_repeat('x', 65)]), 'Long display names rejected', 422);
denied(fn () => $lookup(1, ['not-a-uuid']), 'Malformed server identifiers rejected', 422);
denied(fn () => $lookup(1, [$uuid(1), $uuid(1)]), 'Duplicate server identifiers rejected', 422);
denied(fn () => $lookup(1, []), 'Empty lookup rejected', 422);
denied(fn () => $lookup(1, array_map($uuid, range(1, 101))), 'Oversized batch rejected', 422);
DB::flushQueryLog(); DB::enableQueryLog();
$lookup(1, array_map($uuid, range(1, 100)));
check(count(DB::getQueryLog()) === 1, 'A hundred server lookups use one scoped SQL query');
DB::disableQueryLog();
check($controller->servers(req(1, ['uuids' => [$uuid(1)]]))->headers->get('Cache-Control') === 'no-store, private', 'Region responses cannot be cached publicly');
$controller->delete(req(3), '1');
check($lookup(1, [$uuid(2)])[$uuid(2)] === null && DB::table('servers')->count() === 3, 'Clearing a region preserves servers');
$save(['country_code' => 'US', 'display_name' => null], '3');
DB::table('locations')->where('id', 3)->delete();
check(!DB::table('ext_regiondisplay_locations')->where('location_id', 3)->exists(), 'Deleting a location cascades its assignment');
$migration->down();
check(!Schema::hasTable('ext_regiondisplay_locations'), 'Migration rolls back cleanly');
echo "All backend checks passed in isolated SQLite.\n";
