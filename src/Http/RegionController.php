<?php

declare(strict_types=1);

namespace RegionDisplay\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Server;

final class RegionController extends Controller
{
    private const TABLE = 'ext_regiondisplay_locations';
    private ?array $countryNames = null;

    private function countries(): array
    {
        return $this->countryNames ??= json_decode(file_get_contents(__DIR__ . '/../../resources/countries.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    private function region(?object $row): ?array
    {
        if ($row === null) {
            return null;
        }

        return [
            'country_code' => $row->country_code,
            'display_name' => $row->display_name,
            'name' => $row->display_name ?? $this->countries()[$row->country_code],
        ];
    }

    private function response(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'private, no-store');
    }

    private function adminLocation(Request $request, string $location): Location
    {
        abort_unless($request->user()?->root_admin, 403);

        return Location::query()->findOrFail($location);
    }

    public function show(Request $request, string $location): JsonResponse
    {
        $this->adminLocation($request, $location);

        return $this->response(['region' => $this->region(DB::table(self::TABLE)->where('location_id', $location)->first())]);
    }

    public function update(Request $request, string $location): JsonResponse
    {
        $this->adminLocation($request, $location);
        $data = $request->validate([
            'country_code' => ['required', 'string', Rule::in(array_keys($this->countries()))],
            'display_name' => ['present', 'nullable', 'string', 'max:64'],
        ]);
        $name = trim($data['display_name'] ?? '');
        $data['display_name'] = $name === '' ? null : $name;
        // An atomic upsert keeps exactly one assignment per location.
        DB::table(self::TABLE)->upsert([
            $data + ['location_id' => (int) $location, 'created_at' => now(), 'updated_at' => now()],
        ], ['location_id'], ['country_code', 'display_name', 'updated_at']);

        return $this->show($request, $location);
    }

    public function delete(Request $request, string $location): JsonResponse
    {
        $this->adminLocation($request, $location);
        DB::table(self::TABLE)->where('location_id', $location)->delete();

        return $this->response(['region' => null]);
    }

    public function servers(Request $request): JsonResponse
    {
        abort_unless($request->user(), 401);
        $data = $request->validate([
            'uuids' => ['required', 'array', 'min:1', 'max:100'],
            'uuids.*' => ['required', 'uuid', 'distinct'],
        ]);
        $user = $request->user();
        $accessible = $user->root_admin ? Server::query() : $user->accessibleServers();
        $rows = DB::table('servers')
            ->join('nodes', 'nodes.id', '=', 'servers.node_id')
            ->join(self::TABLE . ' as regions', 'regions.location_id', '=', 'nodes.location_id')
            ->whereIn('servers.id', $accessible->select('servers.id'))
            ->whereIn('servers.uuid', $data['uuids'])
            ->get(['servers.uuid', 'regions.country_code', 'regions.display_name']);
        // Missing and inaccessible servers have the same response, without disclosing their location.
        $regions = array_fill_keys($data['uuids'], null);
        foreach ($rows as $row) {
            $regions[$row->uuid] = $this->region($row);
        }

        return $this->response(['regions' => (object) $regions]);
    }
}
