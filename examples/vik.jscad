"use strict";
// TODO: convex minkowski
// TODO: convex expand in terms of convex minkowski
// TODO: convex expand using a clever patch
// TODO: add steiner point in middle of each 40-gon prior to triangulation for STL... I think?
// TODO: other smart triangulation, with or without steiner points?

function main() {


  try {

    let CHECK = function(cond) {
      if (cond !== true) {
        throw new Error("CHECK failed");
      }
    };


    let showNonMagnets = true; // the actual model
    let showMagnets = false;

    let swissCheese = false;  // set to true to force thinWallThickness to 0


    // modelWidth=20, thickWallThickness=3, separation=1 or 3 or 10 -> $3.34 for one piece, $26.73 for 8 pieces, $15.04 if all fused together as 1 piece

    // Melinda's width is 17.52 mm (in some early model)
    let modelWidth = 20;

    //let separation = 0.;  // to put corner at origin
    //let separation = 3;
    //let separation = -.0001;
    //let separation = 1.5;
    let separation = -modelWidth;  // to center it, roughly

    let doPreRound = true;
    let preRoundRadius = .75;
    //let preRoundRes = 20;
    let preRoundRes = 40; // looks better but takes a while.  faster since using my own rounding

    let thickWallThickness = 2.675;  // was 2

    let pipDiameter = 1.5;  // was 1
    let pipDiskRadiusDegrees = 60.;

    let backwardCompatibleWithFirstPrint = false;
    if (backwardCompatibleWithFirstPrint) {
      thickWallThickness = 2;
      pipDiameter = 1;
    }

    let pipSphereRadius = (pipDiameter/2) / Math.sin(pipDiskRadiusDegrees/180.*Math.PI);

    //let thinWallThickness = .7;  // .7 is minimum allowed
    let thinWallThickness = .675;  // .7 is minimum allowed

    //let cylHeight = thickWallThickness;
    let cylHeight = 2;  // just enough to reach surface... but not enough, really

    let cylinderDiameter = 4;
    let cylinderResolution = 40;




    // Note, scaleFudge other than 1 doesn't really work since the placements of dips/pips/cyls is still in the original space
    let scaleFudge = 1.;
    {
      modelWidth *= scaleFudge;
      separation *= scaleFudge;
      preRoundRadius *= scaleFudge;
      thickWallThickness *= scaleFudge;
      pipDiameter *= scaleFudge;
      pipSphereRadius *= scaleFudge;
      thinWallThickness *= scaleFudge;
      cylinderDiameter *= scaleFudge;
    }

    //==================================================

    if (swissCheese) {
      thinWallThickness = 0.;
    }


    let vpv = (v0,v1) => {
      let answer = [];
      for (let i = 0; i < v0.length; ++i) {
        answer.push(v0[i] + v1[i]);
      }
      return answer;
    };
    let vmv = (v0,v1) => {
      let answer = [];
      for (let i = 0; i < v0.length; ++i) {
        answer.push(v0[i] - v1[i]);
      }
      return answer;
    };
    let sxv = (s,v) => {
      let answer = [];
      for (let x of v) { answer.push(s * x); }
      return answer;
    };
    let dot = (v0,v1) => {
      let answer = 0.;
      for (let i = 0; i < v0.length; ++i) {
        answer += v0[i] * v1[i];
      }
      return answer;
    };
    let len2 = v => dot(v,v);
    let len = v => Math.sqrt(len2(v));
    let normalizedVecAsArray = v => sxv(len(v), v);

    let normalizedCsgVector = v => v.scale(1./v.length());

    // determinant of matrix whose rows are:
    //      b-a
    //      c-a
    //      d-a
    let sixTimesTetVolume = (a,b,c,d) => {
      return b.minus(a).cross(c.minus(a)).dot(d.minus(a));
    };

    //
    // Probably ill-advised geometry / vector math functions...
    //
    let rotateX = function([normal,offset], degrees) {
      let s = Math.sin(degrees/180*Math.PI);
      let c = Math.cos(degrees/180*Math.PI);
      return [[normal[0], normal[1]*c - normal[2]*s, normal[1]*s + normal[2]*c], offset];
    };
    let rotateY = function([normal,offset], degrees) {
      let s = Math.sin(degrees/180*Math.PI);
      let c = Math.cos(degrees/180*Math.PI);
      return [[normal[2]*s + normal[0]*c, normal[1], normal[2]*c - normal[0]*s], offset];
    };
    let rotateZ = function([normal,offset], degrees) {
      let s = Math.sin(degrees/180*Math.PI);
      let c = Math.cos(degrees/180*Math.PI);
      return [[normal[0]*c - normal[1]*s, normal[0]*s + normal[1]*c, normal[2]], offset];
    };
    let translatePlane = function([normal,offset], [dx,dy,dz]) {
      let len2 = normal[0]**2 + normal[1]**2 + normal[2]**2;

      let len = Math.sqrt(len2);
      let point = [offset*normal[0]/len, offset*normal[1]/len, offset*normal[2]/len];
      point[0] += dx;
      point[1] += dy;
      point[2] += dz;
      let answer = [normal, normal[0]*point[0] + normal[1]*point[1] + normal[2]*point[2]];
      return answer;
    };
    let scalePlane = function([normal,offset], s) {
      return [normal, offset*s];
    };
    let angleBetweenUnitVectors = (u,v) => {
      if (u.dot(v) < 0.) {
        return Math.PI - 2*Math.asin(u.plus(v).length()/2.);
      } else {
        return 2*Math.asin(u.minus(v).length()/2.);
      }
    };  // angleBetweenUnitVectors
    let sin_over_x = x => x==0. ? 1. : Math.sin(x)/x;
    // ang must be angleBetweenUnitVectors(u,v)
    let slerp = (u,v,ang,t) => {
      //CHECK(arguments.length == 4); // wait a minute, this doesn't hold for arrow functions??
      let denominator = sin_over_x(ang);
      let a = sin_over_x((1-t)*ang)/denominator * (1-t);
      let b = sin_over_x(t*ang)/denominator * t;
      if (false)
      {
      //for (let x in u) { console.log("          x = "+x); }
      console.log("t = "+t);
      console.log("denominator = "+denominator);
      console.log("a = "+a);
      console.log("b = "+b);
      }
      let answer = u.scale(a).plus(v.scale(b));
      return answer;
    };


    let rotateCSGtakingUnitVectorToUnitVector = (csg, from, to) => {
      // only works when from is z axis.
      CHECK(from[0] == 0);
      CHECK(from[1] == 0);
      CHECK(from[2] == 1);
      if (to[0] == 0 && to[1] == 0) {
        return to[2] >= 0 ? csg : csg.rotateX(180);
      }
      // XXX TODO: should use parallel transport math (2 householder reflections) instead of this
      let lat = Math.atan2(to[2], Math.hypot(to[0], to[1]));
      let lng = Math.atan2(to[1], to[0]);
      csg = csg.rotateY(90. - lat/Math.PI*180);  // Z axis towards X axis
      csg = csg.rotateZ(lng/Math.PI*180);  // X axis towards Y axis
      return csg;
    };

    let makeCylinderTheWayIThoughtItWasSupposedToWork = params => {
      if (false) {
        return CSG.cylinder(params);
      }
      // didn't have any luck with rotated start,end (produces weird shearing),
      // so start with axis aligned and...
      let start = params.start;
      let end = params.end;
      let cyl = CSG.cylinder({
        start: [0,0,0],
        end: [0,0,1],
        radius: cylinderDiameter/2.,
        resolution: cylinderResolution,
      });
      cyl = cyl.scale([1,1,len(vmv(end, start))]);
      let dir = normalizedVecAsArray(vmv(end, start));
      cyl = rotateCSGtakingUnitVectorToUnitVector(cyl, [0,0,1], dir);
      cyl = cyl.translate(start);
      return cyl;
    };  // makeCylinderTheWayIThoughtItWasSupposedToWork

    // following logic of toPointCloud in OpenJsCad source
    let getVerts = A => {
      var answer = [];
      var seen = {};
      for (let polygon of A.polygons) {
        for (let vertex of polygon.vertices) {
          let vertexString = ""+vertex.pos.x+" "+vertex.pos.y+" "+vertex.pos.z;
          if (seen[vertexString] !== 1) {
            seen[vertexString] = 1;
            //answer.push(vertex);
            answer.push([vertex.pos.x, vertex.pos.y, vertex.pos.z]);
          }
        }
      }
      return answer;
    };  // getVerts

    let dumpCSG = (name,A) => {
      console.log("      "+name+":");
      if (false) {  // to see what methods are available
        for (let x in A) { console.log("          x = "+x); }
      }
      console.log("        verts = "+getVerts(A));
    };

    let convexMinkowski = (A,B) => {
      // CBB: this is O(|A|*|B|),
      // could make it faster by only scanning that part of the product
      // that might be on the exterior.
      // To be precise:
      //    -- take each vertex of A, translate it by only
      //       those vertices of B that could form exterior vertex of product
      //    -- take each face of A, translate it by only
      //       that vertex of B that's most extremal for it
      // Or, can we construct it easily by sweeping over the surface??
      // Anyway, here is the brain dead version.
      console.log("    in convexMinkowski");

      dumpCSG("A", A);
      dumpCSG("B", B);

      let Averts = getVerts(A);
      let Bverts = getVerts(B);
      let Cverts = [];
      for (let a of Averts) {
        for (let b of Bverts) {
          //Cverts.push(a.plus(b)); // use this if getVerts returns CSG points
          Cverts.push(vpv(a, b)); // use this if it returns tuples
        }
      }
      console.log("Cverts = "+Cverts);

      // ARGH! this doesn't exist, need to use convex hull function from elsewhere
      //let C = CSG.hull(Cverts);

      let C = A.subtract(B);

      console.log("    out convexMinkowski");
      return C;
    };  // convexMinkowski

    if (false)  // convexMinkowski is not panning out
    {
      let A = CSG.sphere({
        resolution:12,
      });
      let B = CSG.cube().scale(.75);
      let C = convexMinkowski(A, B);
      return C;
    }

    // utility function for getting one's bearings in a CSG mesh
    let getMeshArrays = A => {
      let verts = [];
      let f2v = [];  // face to vertex indices
      {
        let vertStringToVertIndex = {};
        for (let face of A.polygons) {
          f2v.push([]);
          for (let vertex of face.vertices) {
            let vertexString = ""+vertex.pos.x+" "+vertex.pos.y+" "+vertex.pos.z;
            let index = vertStringToVertIndex[vertexString];
            if (index === undefined) {
              index = verts.length;
              verts.push(vertex);
              vertStringToVertIndex[vertexString] = index;
            }
            f2v[f2v.length-1].push(index);
          }
        }
      }

      console.log("      verts = "+JSON.stringify(verts));
      console.log("      f2v = "+JSON.stringify(f2v));

      let e2v = [];  // list of ordered pairs of vertex indices. e2v[i^1] is the opposite of e2v[i].
      let f2e = [];  // face to edge indices, in order around p. f2e[p][i] is [f2v[p][i], f2v[p][(i+1)%f2v[p].length].
      let e2f = [];
      {
        let edgeKeyToEdgeIndex = {};
        for (let p = 0; p < f2v.length; ++p) {
          let poly = f2v[p];
          f2e.push([]);
          for (let i = 0; i < poly.length; ++i) {
            let v0 = poly[i];
            let v1 = poly[(i+1)%poly.length];
            let edgeKey = v0*verts.length+v1;
            let oppositeEdgeKey = v1*verts.length+v0;
            let edgeIndex = edgeKeyToEdgeIndex[edgeKey];
            if (edgeIndex === undefined) {
              edgeIndex = e2v.length;
              e2v.push([v0,v1]);
              e2v.push([v1,v0]);
              e2f.push(-1);
              e2f.push(-1);
              edgeKeyToEdgeIndex[edgeKey] = edgeIndex;
              edgeKeyToEdgeIndex[oppositeEdgeKey] = edgeIndex+1;
            }
            let oppositeEdgeIndex = edgeIndex^1;
            CHECK(edgeKeyToEdgeIndex[edgeKey] == edgeIndex);
            CHECK(edgeKeyToEdgeIndex[oppositeEdgeKey] == oppositeEdgeIndex);
            CHECK(e2v[edgeIndex][0] == v0);
            CHECK(e2v[edgeIndex][1] == v1);
            CHECK(e2v[oppositeEdgeIndex][0] == v1);
            CHECK(e2v[oppositeEdgeIndex][1] == v0);
            f2e[f2e.length-1].push(edgeIndex);
            e2f[edgeIndex] = p;
            // e2f[oppositeEdgeIndex] may not be set yet
          }
        }
      }
      for (let p of e2f) {
        CHECK(p >= 0);  // if this fails, non-manifold or something
      }

      console.log("      e2v = "+JSON.stringify(e2v));
      console.log("      f2e = "+JSON.stringify(f2e));

      let e2next = [];  // edge index to next edge index on same face
      let e2prev = [];  // edge index to next edge index on same face
      {
        for (let i = 0; i < e2v.length; ++i) {
          e2next.push(null);
          e2prev.push(null);
        }
        for (let f of f2e) {
          for (let i = 0; i < f.length; ++i) {
            e2next[f[i]] = f[(i+1)%f.length];
            e2prev[f[(i+1)%f.length]] = f[i];
          }
        }
      }
      console.log("      e2next = "+JSON.stringify(e2next));
      console.log("      e2prev = "+JSON.stringify(e2prev));

      // v2e[iVert] is the edges emanating from iVert,
      // in CW order (if faces are CCW).
      let v2e = [];
      {
        for (let iVert = 0; iVert < verts.length; ++iVert) {
          v2e.push([]);
        }
        for (let iEdge = 0; iEdge < e2v.length; ++iEdge) {
          let v0 = e2v[iEdge][0];
          if (v2e[v0].length == 0) {
            v2e[v0].push(iEdge);
            for (let jEdge = e2next[iEdge^1];
                 jEdge != iEdge;
                 jEdge = e2next[jEdge^1]) {
              v2e[v0].push(jEdge);
            }
          }
        }
      }
      console.log("      v2e = "+JSON.stringify(v2e));
      return [verts,f2v,e2v,f2e,e2f,e2next,e2prev,v2e];
    }; // getMeshArrays


    // resolution is number of subdivs of 360 degrees.
    // actual number of subdivs is formed by rounding.
    // verts must be trivalent.
    let convexExpand = (A,radius,resolution) => {
      let [verts,f2v,e2v,f2e,e2f,e2next,e2prev,v2e] = getMeshArrays(A);

      let answerPolygons = [];

      if (true) {
        // Each face in A produces a face in answer.
        for (let polygon of A.polygons) {
          let offset = polygon.plane.normal.scale(radius);
          let answerPolygonVerts = [];
          for (let vertex of polygon.vertices) {
            answerPolygonVerts.push(vertex.translate(offset));
          }
          answerPolygons.push(new CSG.Polygon(answerPolygonVerts));
        }
      }

      if (true) {
        // Each edge in A produces a cylindrical patch in answer.
        for (let iWholeEdge = 0; 2*iWholeEdge < e2v.length; iWholeEdge++) {
          let iEdge = 2*iWholeEdge;
          let oEdge = iEdge+1;
          let f0 = e2f[iEdge];
          let f1 = e2f[oEdge];
          let v0 = e2v[iEdge][0];
          let v1 = e2v[iEdge][1];
          // The edge on f0 is [v0,v1].
          // The edge on f1 is [v1,v0].
          let f0normal = A.polygons[f0].plane.normal;
          let f1normal = A.polygons[f1].plane.normal;

          let angle = angleBetweenUnitVectors(f0normal, f1normal);
          let nSubdivsHere = Math.max(1, Math.round(angle/(2*Math.PI)*resolution));
          for (let i = 0; i < nSubdivsHere; ++i) {
            // calculate the two normals two different ways, to guarantee matching
            answerPolygons.push(new CSG.Polygon([
              verts[v0].translate(slerp(f0normal, f1normal, angle, i/nSubdivsHere).scale(radius)),
              verts[v0].translate(slerp(f0normal, f1normal, angle, (i+1)/nSubdivsHere).scale(radius)),
              verts[v1].translate(slerp(f1normal, f0normal, angle, (nSubdivsHere-1-i)/nSubdivsHere).scale(radius)),
              verts[v1].translate(slerp(f1normal, f0normal, angle, (nSubdivsHere-i)/nSubdivsHere).scale(radius)),
            ]));
          }
        }
      }

      // Each vertex in A produces a spherical patch in answer.

      for (let iVert = 0; iVert < verts.length; ++iVert) {
        let theVertex = verts[iVert];
        let normals = [];
        {
          let edgesThisVert = v2e[iVert];
          for (let iEdgeThisVert = 0; iEdgeThisVert < edgesThisVert.length; ++iEdgeThisVert) {
            let e = edgesThisVert[iEdgeThisVert];
            normals.push(A.polygons[e2f[e]].plane.normal);
          }
        }
        normals.reverse(); // change from CW order to CCW order

        let perimeter = [];
        for (let i = 0; i < normals.length; ++i) {
          let normal0 = normals[i];
          let normal1 = normals[(i+1)%normals.length];
          let angle = angleBetweenUnitVectors(normal0, normal1);
          let nSubdivsHere = Math.max(1, Math.round(angle/(2*Math.PI)*resolution));
          let perimeterSide = [];
          for (let i = 0; i < nSubdivsHere; ++i) {
            // compute backwards from normal1 to normal0, same as was done when computing
            // the neighboring cylindrical patch, so that we'll get exactly same answer (hopefully)
            let normal = slerp(normal1, normal0, angle, (nSubdivsHere-i)/nSubdivsHere);
            perimeterSide.push(normal);
          }
          perimeter.push(perimeterSide);
        }
        //console.log("perimeter = "+JSON.stringify(perimeter));

        let computeSphericalPatch = (perimeter, resolutionInCaseOfFurtherSubdivision) => {
          if (perimeter.length != 3) {
            // We only know how to deal with a (subdivided) spherical triangle.
            // So, triangulate.
            // CBB: should pick triangulation smartly.  But for this application,
            // it's a symmetric quad so it doesn't matter.
            CHECK(perimeter.length === 4);
            CHECK(resolutionInCaseOfFurtherSubdivision != -1);
            let [ab,bc,cd,da] = perimeter;
            let [a,b,c,d] = [ab[0],bc[0],cd[0],da[0]];
            let angle = angleBetweenUnitVectors(a, c);
            let nSubdivsHere = Math.max(1, Math.round(angle/(2*Math.PI)*resolutionInCaseOfFurtherSubdivision));
            let additionalDiagonalPoints = [];
            for (let i = 1; i < nSubdivsHere; ++i) {
              additionalDiagonalPoints.push(slerp(a, c, angle, i/nSubdivsHere));
            }
            let ac = [a];
            for (let i = 0; i < additionalDiagonalPoints.length; ++i) {
              ac.push(additionalDiagonalPoints[i]);
            }
            let ca = [c];
            for (let i = 0; i < additionalDiagonalPoints.length; ++i) {
              ca.push(additionalDiagonalPoints[additionalDiagonalPoints.length-1-i]);
            }
            let answer0 = computeSphericalPatch([ab,bc,ca], -1);
            let answer1 = computeSphericalPatch([ac,cd,da], -1);
            let answer = [];
            for (let normal of answer0) answer.push(normal);
            for (let normal of answer1) answer.push(normal);
            return answer;
          }
          CHECK(perimeter.length === 3);

          let [v01,v12,v20] = perimeter;

          // cycle until v12 is smallest
          while (v01.length < v12.length || v20.length < v12.length) {
            [v01,v12,v20] = [v12,v20,v01];
          }

          let gridPoints = [];
          for (let iy = 0; iy <= Math.max(v01.length,v20.length); ++iy) {
            gridPoints.push([]);
            for (let ix = 0; ix <= v12.length; ++ix) {
              gridPoints[iy].push(null);
            }
          }
          for (let i = 0; i < v12.length; ++i) {
            CHECK(gridPoints[0][i] === null);
            gridPoints[0][i] = v12[i];
          }
          for (let i = 0; i < v01.length; ++i) {
            CHECK(gridPoints[gridPoints.length-1-i][0] === null);
            gridPoints[gridPoints.length-1-i][0] = v01[i];
          }
          for (let i = 0; i < v20.length-v01.length; ++i) {
            CHECK(gridPoints[i+1][0] === null);
            gridPoints[i+1][0] = v12[0];
          }
          for (let i = 0; i < v01.length-v20.length; ++i) {
            CHECK(gridPoints[i][v12.length] === null);
            gridPoints[i][v12.length] = v20[0];
          }
          for (let i = 0; i < v20.length; ++i) {
            CHECK(gridPoints[Math.max(v01.length-v20.length,0)+i][v12.length] === null);
            gridPoints[Math.max(v01.length-v20.length,0)+i][v12.length] = v20[i];
          }
          for (let i = 0; i < v12.length; ++i) {
            CHECK(gridPoints[gridPoints.length-1][i+1] === null);
            gridPoints[gridPoints.length-1][i+1] = v01[0];
          }

          for (let iy = 0; iy < gridPoints.length; ++iy) {
            for (let ix = 0; ix < gridPoints[iy].length; ++ix) {
              if (ix == 0 || iy == 0 || ix == gridPoints[iy].length-1 || iy == gridPoints.length-1) {
                CHECK(gridPoints[iy][ix] !== null);
              } else {
                CHECK(gridPoints[iy][ix] === null);
                let W = gridPoints[iy][0];
                let E = gridPoints[iy][gridPoints[iy].length-1];
                let S = gridPoints[0][ix];
                let N = gridPoints[gridPoints.length-1][ix];
                let SxN = S.cross(N);
                let WxE = W.cross(E);
                gridPoints[iy][ix] = normalizedCsgVector(WxE.cross(SxN));
              }
              CHECK(gridPoints[iy][ix] !== null);
            }
          }
          let answer = [];
          for (let iy = 0; iy+1 < gridPoints.length; ++iy) {
            for (let ix = 0; ix+1 < gridPoints[iy].length; ++ix) {
              let a = gridPoints[iy][ix];
              let b = gridPoints[iy][ix+1];
              let c = gridPoints[iy+1][ix+1];
              let d = gridPoints[iy+1][ix];
              if (c == d) {
                answer.push([a,b,c]);
              } else if (b == c) {
                answer.push([a,b,d]);
              } else if (a == d) {
                answer.push([a,b,c]);
              } else {
                let volume = sixTimesTetVolume(a,b,c,d);
                if (volume < 0.) {
                  answer.push([a,b,c]);
                  answer.push([a,c,d]);
                } else {
                  answer.push([a,b,d]);
                  answer.push([b,c,d]);
                }
              }
            }
          }
          return answer;
        };  // computeSphericalPatch

        let sphericalPatchNormalTriples = computeSphericalPatch(perimeter, resolution);
        //console.log("sphericalPatchNormalTriples = "+JSON.stringify(sphericalPatchNormalTriples));
        for (let normalTriple of sphericalPatchNormalTriples) {
          let triVerts = [];
          for (let normal of normalTriple) {
            triVerts.push(theVertex.translate(normal.scale(radius)));
          }
          answerPolygons.push(new CSG.Polygon(triVerts));
        }
      }  // for iVert

      let answer = CSG.fromPolygons(answerPolygons);

      console.log("        out simpleConvexExpand");
      return answer;
    };  // convexExpand


    if (false) {
      let A = CSG.cube({
        radius: 1./3,
      });
      let radius = .1;
      let log2resolution = 4;

      let B = A;

      if (true) {
        // something random
        B = B.intersect(B.rotateX(37).rotateY(22).rotateZ(13));
      }

      console.log("B = "+B);

      if (true) {
        B = convexExpand(B, radius, 1<<log2resolution);
      }
      return B;
    }

    // End of utilities
    //=======================================================================


    // Start with 1/3 of the planes of the outer polyhedron...
    let planes = [
        [[0.3333333333333333,0.6666666666666667,0.6666666666666667],1.], // corner
        [[0.5773502691896258,0.5773502691896258,0.5773502691896258],0.8909765116357686], // face
        [[0.5,0.5,0.7071067811865475],0.9667811436055143], // frontishEdge
        [[0.5,0.7071067811865475,0.5],0.9667811436055143], // toppishEdge
        //[[-0.7071067811865475,0,-0.7071067811865475],0], // backLeftBounding
        //[[-0.7071067811865475,-0.7071067811865475,0],0], // downLeftBounding
        [[0.7071067811865475,0,-0.7071067811865475],0], // backRightBounding
        //[[0.7071067811865475,-0.7071067811865475,0],0], // downRightBounding
    ];

    // Rotate, to form all the planes of the outer polyhedron...
    if (true)
    {
      let n = planes.length;
      for (let i = 0; i < 2*n; ++i) {
        let plane = planes[i];
        let normal = plane[0];
        let offset = plane[1];
        // rotate z -> y -> -x
        //planes.push([[-normal[1],normal[2],normal[0]], offset]);
        // no, it's this instead.  I have no idea why.
        planes.push([[-normal[1],normal[2],-normal[0]], offset]);
      }
    }

    // its right corner is pointed at -1,1,1.  re-point it at 1,1,1.
    for (let plane of planes) {
      plane[0] = [plane[0][1], -plane[0][0], plane[0][2]];
    }
    console.log("planes.length = "+planes.length);
    //console.log("planes = "+planes);


    if (true) {
      // Try to get the three primary faces axis aligned at the origin
      for (let i = 0; i < planes.length; ++i) {
        let plane = planes[i];

        plane = rotateZ(plane, 45);
        plane = rotateX(plane, -Math.atan2(1,Math.sqrt(2))/Math.PI*180);
        plane = rotateY(plane, 60);
        plane = rotateX(plane, Math.atan2(1,Math.sqrt(2))/Math.PI*180);
        plane = rotateZ(plane, -45);
        plane = translatePlane(plane, [-1,-1,-1]);
        plane = rotateZ(plane, 180);
        plane = rotateX(plane, 90);

        // Fudge so first set of stuff is roughly on xy plane,
        // since that's what I assume when making cylinders
        plane = rotateY(plane, -90);
        plane = rotateZ(plane, -90);

        planes[i] = plane;
      }
    }

    let clay = CSG.cube({radius: 10});
    for (let planeSpec of planes) {
      let normal = planeSpec[0];
      let offset = planeSpec[1];
      //let plane = new CSG.Plane(normal, offset);
      var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
      clay = clay.cutByPlane(plane);
    }


    // Figure out bounding box
    if (false) {
      console.log("clay.getBounds() = "+clay.getBounds());
      console.log("clay.getBounds()[0] = "+clay.getBounds()[0]);
      console.log("clay.getBounds()[1] = "+clay.getBounds()[1]);
      console.log("clay.getBounds()[0].x = "+clay.getBounds()[0].x);
      console.log("clay.getBounds()[0].y = "+clay.getBounds()[0].y);
      console.log("clay.getBounds()[0].z = "+clay.getBounds()[0].z);
      console.log("clay.getBounds()[1].x = "+clay.getBounds()[1].x);
      console.log("clay.getBounds()[1].y = "+clay.getBounds()[1].y);
      console.log("clay.getBounds()[1].z = "+clay.getBounds()[1].z);
    }

    let scale = modelWidth/(clay.getBounds()[1].y - clay.getBounds()[0].y);  // arbitrary one of the three
    console.log("scaling by "+scale+" to get modelWidth="+modelWidth);

    clay = clay.scale(scale);
    if (false) {
      console.log("clay.getBounds() = "+clay.getBounds());
      console.log("clay.getBounds()[0] = "+clay.getBounds()[0]);
      console.log("clay.getBounds()[1] = "+clay.getBounds()[1]);
      console.log("clay.getBounds()[0].x = "+clay.getBounds()[0].x);
      console.log("clay.getBounds()[0].y = "+clay.getBounds()[0].y);
      console.log("clay.getBounds()[0].z = "+clay.getBounds()[0].z);
      console.log("clay.getBounds()[1].x = "+clay.getBounds()[1].x);
      console.log("clay.getBounds()[1].y = "+clay.getBounds()[1].y);
      console.log("clay.getBounds()[1].z = "+clay.getBounds()[1].z);
    }

    // and scale the planes too, to be used in subsequent operations
    for (let i = 0; i < planes.length; ++i) {
      planes[i] = scalePlane(planes[i], scale);
    }

    if (doPreRound && preRoundRadius > 0.) {
      console.log("    starting pre-round");
      clay = clay.contract(preRoundRadius, preRoundRes);
      console.log("    halfway done with pre-round");

      if (false) {
        clay = clay.expand(preRoundRadius, preRoundRes);
      } else if (false) {
        //let log2resolution = 3;   // that's equivalent to 32 around a circle, for the right angles. (confusing)
        let log2resolution = 4;   // that's equivalent to 64 around a circle, for the right angles. (confusing)
        clay = simpleConvexExpand(clay, preRoundRadius, log2resolution);
      } else {
        clay = convexExpand(clay, preRoundRadius, preRoundRes);
      }

      console.log("    done with pre-round");
    }

    if (true) {
      // Try to place the dips/pips.
      let facePlane = planes[4];
      let [faceNormal,faceOffset] = facePlane;
      let elevationFudge = Math.cos(pipDiskRadiusDegrees/180.*Math.PI) * pipSphereRadius;
      console.log("elevationFudge = "+elevationFudge);
      let pips = [];
      let dips = [];
      {
        // the less exposed one.
        // y barely big enough (in magnitude) to get rid of the red
        let center = [0,-1.875,3];
        if (backwardCompatibleWithFirstPrint) center[1] = -2.25;
        // Adjust center so it's on the plane
        let delta = sxv(faceOffset - dot(faceNormal, center), faceNormal);
        center = vpv(center, delta);
        let sphere = CSG.sphere({
          radius: pipSphereRadius,
          center: center,
          resolution: 40,  // default is 12
        });
        pips.push(sphere.translate(sxv(-elevationFudge, faceNormal)));
        sphere = sphere.mirrored(CSG.Plane.fromPoints([0,0,0],[1,0,0],[1,1,1]));
        dips.push(sphere.translate(sxv(elevationFudge, faceNormal)));
      }
      {
        // the more exposed one.
        // y barely big enough (in magnitude) to get rid of the red
        let center = [0,-.8625,10];
        if (backwardCompatibleWithFirstPrint) center[1] = -1.1;
        // Adjust center so it's on the plane
        let delta = sxv(faceOffset - dot(faceNormal, center), faceNormal);
        center = vpv(center, delta);
        let sphere = CSG.sphere({
          radius: pipSphereRadius,
          center: center,
          resolution: 40,  // default is 12
        });
        pips.push(sphere.translate(sxv(-elevationFudge, faceNormal)));
        sphere = sphere.mirrored(CSG.Plane.fromPoints([0,0,0],[1,0,0],[1,1,1]));
        dips.push(sphere.translate(sxv(elevationFudge, faceNormal)));
      }
      // convert from array to single object
      pips = pips.reduce((a,b) => a.union(b));
      dips = dips.reduce((a,b) => a.union(b));

      if (true) {
        pips = pips.union(pips.rotateZ(90).rotateY(90))
                         .union(pips.rotateY(-90).rotateZ(-90));
        dips = dips.union(dips.rotateZ(90).rotateY(90))
                         .union(dips.rotateY(-90).rotateZ(-90));
      }

      clay = clay.union(pips);
      clay = clay.subtract(dips);
    }

    if (true) {
      let knife = CSG.cube({radius: 2*scale});
      for (let planeSpec of planes) {
        let normal = planeSpec[0];
        let offset = planeSpec[1];

        if (normal[0]>0 && normal[1]>0 && normal[2]>0) continue;

        offset -= thickWallThickness;
        var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
        knife = knife.cutByPlane(plane);
      }
      clay = clay.subtract(knife);
    }


    if (true) {
      // Try to place cylindrical holes.

      let makeTheCyls = cylHeight => {
        let cyls = null;
        {
          // one of the cylinders on corner face
          let x = 10.5;
          //let y = 4.5;
          let y = 5.5;
          let cyl = CSG.cylinder({
            start: [x,y,thinWallThickness],  // default start is [0,-1,0]
            end: [x,y,thinWallThickness+cylHeight], // default end is [0,1,0]
            radius: cylinderDiameter/2., // default radius is 1
            resolution: cylinderResolution, // default resolution is 32

            //center: true, // default: center:false   XXX doesn't seem to matter?
            center: [true,true,false], // default: center:false   XXX doesn't seem to matter-- always centers??
          });
          cyls = cyl;
        }

        {
          // 1 of the cylinders on "face" face
          let facePlane = planes[1];
          let [faceNormal,faceOffset] = facePlane;

          //let start = [14.75, 11, 0];

          // try closer together to make room for the clips
          // in one of the possible places
          //let start = [15, 11.75, 0];  // bad
          let start = [14.875, 11.625, 0];  // good

          // Adjust start so it's on the plane
          let delta = sxv(faceOffset - dot(faceNormal, start), faceNormal);
          start = vpv(start, delta);
          // Adjust start by thinWallThickness
          start = vpv(start, sxv(-thinWallThickness, faceNormal));
          let end = vpv(start, sxv(-cylHeight, faceNormal));

          let cyl = makeCylinderTheWayIThoughtItWasSupposedToWork({
            start: start,
            end: end,
            radius: cylinderDiameter/2.,
            resolution: cylinderResolution,
          });

          cyls = cyls.union(cyl);
        }

        {
          // the cylinder on one of the "edge" faces
          let facePlane = planes[2];
          let [faceNormal,faceOffset] = facePlane;

          //let start = [5, 16.5, 0];
          //let start = [4.5, 16.675, 0];  // had this for a while, Melinda pointed out it won't have clearance
          //let start = [5.125, 16.675, 0];  // too close to edge! red
          //let start = [5.125, 16.5, 0];  // pretty good.  magnets might still be brushing though
          let start = [5.25, 16.5, 0];  // pretty good.  magnets might still be brushing though

          // Adjust start so it's on the plane
          let delta = sxv(faceOffset - dot(faceNormal, start), faceNormal);
          start = vpv(start, delta);
          // Adjust start by thinWallThickness
          start = vpv(start, sxv(-thinWallThickness, faceNormal));
          let end = vpv(start, sxv(-cylHeight, faceNormal));


          let cyl = makeCylinderTheWayIThoughtItWasSupposedToWork({
            start: start,
            end: end,
            radius: cylinderDiameter/2.,
            resolution: cylinderResolution,
          });

          cyls = cyls.union(cyl);
        }

        if (true) {
          cyls = cyls.union(cyls.mirrored(CSG.Plane.fromPoints([0,0,0],[1,1,0],[1,1,1])));
        }
        if (true) {
          cyls = cyls.union(cyls.rotateZ(90).rotateY(90))
                     .union(cyls.rotateY(-90).rotateZ(-90));
        }
        return cyls;
      };  // makeTheCyls

      if (showNonMagnets) {
        clay = clay.subtract(makeTheCyls(cylHeight + .1));
      } else {
        let makeEmptyCSG = () => {
          // XXX is this the easiest way?
          return CSG.cube().subtract(CSG.cube());
        };
        clay = makeEmptyCSG();
      }
      if (showMagnets) {
        clay = clay.union(makeTheCyls(cylHeight));
      }
    }

    clay = clay.translate([separation/2,separation/2,separation/2]);

    if (true) {
      let polygonSizes = clay.polygons.map(polygon => {
        // return polygon.length;
        let polygonSize = 0;
        for (let vertex of polygon.vertices) {
          polygonSize++;
        }
        return polygonSize;
      });
      console.log("      "+clay.polygons.length+" polygon sizes = "+JSON.stringify(polygonSizes));
    }

    let answer = clay;
    if (false) {
      // Replicate 8 times
      answer = answer.union(answer.rotateZ(90));
      answer = answer.union(answer.rotateZ(180));
      answer = answer.union(answer.rotateX(180));
    }

    return answer;
  } catch (e) {
    console.error("HEY! caught: ",e);
    throw e;
  }
}
