<?php

use Illuminate\Support\Facades\Route;
use RegionDisplay\Http\RegionController;

Route::get('/locations/{location}', [RegionController::class, 'show'])->whereNumber('location');
Route::put('/locations/{location}', [RegionController::class, 'update'])->whereNumber('location');
Route::delete('/locations/{location}', [RegionController::class, 'delete'])->whereNumber('location');
