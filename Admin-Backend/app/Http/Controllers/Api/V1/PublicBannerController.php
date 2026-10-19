<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PublicBannerCache;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PublicBannerController extends Controller
{
    public function active(Request $request, PublicBannerCache $cache): Response
    {
        $page = $request->validate(['page' => ['sometimes', 'in:landing,listing']])['page'] ?? 'landing';
        $response = response()->json($cache->payload($page));
        $response->setEtag(hash('sha256', $response->getContent()));
        $response->headers->set('Cache-Control', 'public, max-age=0, must-revalidate');
        $response->isNotModified($request);

        return $response;
    }
}
